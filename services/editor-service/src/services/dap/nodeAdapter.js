/**
 * Node.js debug adapter via Chrome DevTools Protocol (inspector).
 *
 * Spawns: node --inspect-brk=127.0.0.1:0 <program>
 * Connects to the inspector WebSocket and maps DAP-like operations to CDP.
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const WebSocket = require('ws');

class NodeInspectorAdapter extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.ws = null;
    this.cdpId = 1;
    this.pending = new Map();
    this.scriptIdByUrl = new Map();
    this.urlByScriptId = new Map();
    this.breakpoints = [];
    this.paused = false;
    this._lastPause = null;
    this._terminated = false;
    this._entryPausePromise = null;
  }

  async start({ program, cwd, args = [], env = {}, stopOnEntry = true }) {
    const absProgram = path.isAbsolute(program) ? program : path.join(cwd || process.cwd(), program);
    if (!fs.existsSync(absProgram)) {
      const err = new Error(`Program not found: ${absProgram}`);
      err.code = 'DEBUG_PROGRAM_MISSING';
      throw err;
    }

    const workCwd = cwd || path.dirname(absProgram);
    this.proc = spawn(process.execPath, ['--inspect-brk=127.0.0.1:0', absProgram, ...args], {
      cwd: workCwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.proc.stdout.on('data', (chunk) => {
      this.emit('output', { category: 'stdout', output: chunk.toString('utf8') });
    });

    let stderrBuf = '';
    let inspectorReady = false;
    const wsUrl = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for Node inspector URL')), 10000);
      this.proc.stderr.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        stderrBuf += text;
        this.emit('output', { category: 'stderr', output: text });
        const m = stderrBuf.match(/Debugger listening on (ws:\/\/[^\s]+)/);
        if (m && !inspectorReady) {
          inspectorReady = true;
          clearTimeout(timer);
          resolve(m[1]);
        }
      });
      this.proc.on('error', (err) => {
        if (!inspectorReady) {
          clearTimeout(timer);
          reject(err);
        }
      });
      this.proc.on('exit', (code) => {
        this._terminated = true;
        if (!inspectorReady) {
          clearTimeout(timer);
          reject(new Error(`Node process exited before inspector ready (code=${code})`));
        } else {
          this.emit('terminated', { code });
          this._cleanupWs();
        }
      });
    });

    // Wait for real Debugger.paused before advertising entry stop
    this._entryPausePromise = new Promise((resolve) => {
      this._resolveEntryPause = resolve;
    });

    await this._connect(wsUrl);
    await this._cdp('Debugger.enable');
    await this._cdp('Runtime.enable');

    // Release the inspect-brk wait so V8 delivers the entry pause to Debugger
    try {
      await this._cdp('Runtime.runIfWaitingForDebugger');
    } catch { /* older Node may not need this */ }

    // Wait for entry pause (with timeout fallback)
    await Promise.race([
      this._entryPausePromise,
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);

    if (!this.paused && this._lastPause) {
      this.paused = true;
    }

    this._entryEmitted = true;
    // Always remain paused after attach so the manager can set breakpoints
    // before optionally continuing (stopOnEntry=false).
    this.emit('stopped', { reason: 'entry', threadId: 1 });

    return { adapter: 'node', program: absProgram, inspectorUrl: wsUrl };
  }

  _connect(wsUrl) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      this.ws.on('open', () => resolve());
      this.ws.on('error', reject);
      this.ws.on('message', (data) => this._onMessage(data.toString('utf8')));
      this.ws.on('close', () => {
        this._cleanupWs();
        if (!this._terminated) {
          this._terminated = true;
          this.emit('terminated', { reason: 'inspector_closed' });
        }
      });
    });
  }

  _cleanupWs() {
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    for (const [, { reject }] of this.pending) {
      reject(Object.assign(new Error('Inspector connection closed'), { code: 'DEBUG_INSPECTOR_CLOSED' }));
    }
    this.pending.clear();
  }

  _onMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.id != null && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || 'CDP error'));
      else resolve(msg.result);
      return;
    }

    if (msg.method === 'Debugger.scriptParsed') {
      const { scriptId, url } = msg.params || {};
      if (scriptId && url) {
        this.scriptIdByUrl.set(url, scriptId);
        this.urlByScriptId.set(scriptId, url);
      }
    } else if (msg.method === 'Debugger.paused') {
      this.paused = true;
      this._lastPause = msg.params;
      if (this._resolveEntryPause) {
        this._resolveEntryPause();
        this._resolveEntryPause = null;
      }
      // Skip duplicate entry emit — start() emits once after wait
      if (!this._entryEmitted) {
        // During start() wait; start will emit
        return;
      }
      const reason = msg.params?.reason || 'breakpoint';
      this.emit('stopped', { reason, threadId: 1 });
    } else if (msg.method === 'Debugger.resumed') {
      this.paused = false;
      this.emit('continued', {});
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const args = (msg.params?.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      this.emit('output', { category: 'console', output: `${args}\n` });
    }
  }

  _cdp(method, params = {}, timeoutMs = 15000) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(Object.assign(new Error('Inspector WebSocket not connected'), { code: 'DEBUG_INSPECTOR_CLOSED' }));
    }
    const id = this.cdpId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (r) => { clearTimeout(timer); resolve(r); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Resume/step that tolerates debuggee exiting before CDP ACK */
  async _stepOrResume(method, params = {}) {
    try {
      await this._cdp(method, params);
      this.paused = method === 'Debugger.pause' ? true : false;
    } catch (err) {
      if (err.code === 'DEBUG_INSPECTOR_CLOSED' || this._terminated) {
        this.paused = false;
        return;
      }
      throw err;
    }
  }

  async setBreakpoints(breakpoints = []) {
    for (const bp of this.breakpoints) {
      if (bp.cdpId) {
        try { await this._cdp('Debugger.removeBreakpoint', { breakpointId: bp.cdpId }); } catch { /* ignore */ }
      }
    }

    const verified = [];
    for (const bp of breakpoints) {
      const sourcePath = bp.path || bp.source || bp.fileId;
      if (!sourcePath || !bp.line) continue;
      const abs = path.isAbsolute(sourcePath) ? sourcePath : sourcePath;
      const urlRegex = this._pathToUrlRegex(abs);
      try {
        const result = await this._cdp('Debugger.setBreakpointByUrl', {
          lineNumber: Math.max(0, Number(bp.line) - 1),
          urlRegex,
          columnNumber: bp.column != null ? Number(bp.column) : 0,
          condition: bp.condition || undefined,
        });
        verified.push({
          id: result.breakpointId,
          path: abs,
          line: Number(bp.line),
          verified: true,
          cdpId: result.breakpointId,
        });
      } catch (err) {
        verified.push({
          path: abs,
          line: Number(bp.line),
          verified: false,
          message: err.message,
        });
      }
    }
    this.breakpoints = verified;
    return verified;
  }

  _pathToUrlRegex(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return `(?:file://)?(?:/)?.*${escaped}$`;
  }

  async configurationDone() {
    this._entryEmitted = true;
    return {};
  }

  async continue() {
    await this._stepOrResume('Debugger.resume');
  }

  async next() {
    await this._stepOrResume('Debugger.stepOver');
  }

  async stepIn() {
    await this._stepOrResume('Debugger.stepInto');
  }

  async stepOut() {
    await this._stepOrResume('Debugger.stepOut');
  }

  async pause() {
    await this._stepOrResume('Debugger.pause');
  }

  _normalizePath(url) {
    if (!url) return null;
    let p = String(url);
    if (p.startsWith('file://')) {
      p = p.replace(/^file:\/\//, '');
      // file:///workspace/... → /workspace/...
      if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1); // Windows file:///C:/...
    }
    return p;
  }

  async stackTrace() {
    const frames = this._lastPause?.callFrames || [];
    return frames.map((f, idx) => ({
      id: idx + 1,
      name: f.functionName || '(anonymous)',
      line: (f.location?.lineNumber ?? 0) + 1,
      column: f.location?.columnNumber ?? 0,
      path: this._normalizePath(this.urlByScriptId.get(f.location?.scriptId) || f.url || null),
      callFrameId: f.callFrameId,
      scopeChain: f.scopeChain,
    }));
  }

  async scopes(frameId) {
    const frames = await this.stackTrace();
    const frame = frames.find((f) => f.id === frameId) || frames[0];
    if (!frame?.scopeChain) return [];
    return frame.scopeChain.map((s, i) => ({
      name: s.type || `scope${i}`,
      variablesReference: i + 1,
      expensive: false,
      _objectId: s.object?.objectId,
    }));
  }

  async variables(variablesReference) {
    const frames = await this.stackTrace();
    const frame = frames[0];
    const scope = frame?.scopeChain?.[variablesReference - 1];
    const objectId = scope?.object?.objectId;
    if (!objectId) return [];
    const result = await this._cdp('Runtime.getProperties', {
      objectId,
      ownProperties: true,
      accessorPropertiesOnly: false,
    });
    return (result.result || [])
      .filter((p) => p.enumerable !== false)
      .map((p) => ({
        name: p.name,
        value: p.value?.description ?? p.value?.value ?? String(p.value?.type || ''),
        type: p.value?.type,
        variablesReference: 0,
      }));
  }

  async stop() {
    this._terminated = true;
    try {
      if (this.ws) await this._cdp('Runtime.terminateExecution', {}, 2000).catch(() => {});
    } catch { /* ignore */ }
    this._cleanupWs();
    if (this.proc && !this.proc.killed) {
      try { this.proc.kill('SIGTERM'); } catch { /* ignore */ }
    }
  }
}

/** Optional: resolve inspector via HTTP /json/list if stderr parse fails */
const fetchInspectorWsUrl = (port) => new Promise((resolve, reject) => {
  http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
    let data = '';
    res.on('data', (c) => { data += c; });
    res.on('end', () => {
      try {
        const list = JSON.parse(data);
        const target = list.find((t) => t.webSocketDebuggerUrl) || list[0];
        if (!target?.webSocketDebuggerUrl) reject(new Error('No inspector target'));
        else resolve(target.webSocketDebuggerUrl);
      } catch (err) {
        reject(err);
      }
    });
  }).on('error', reject);
});

module.exports = { NodeInspectorAdapter, fetchInspectorWsUrl };
