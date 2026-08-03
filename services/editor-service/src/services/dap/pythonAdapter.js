/**
 * Python DAP adapter via debugpy (stdio).
 *
 * Requires: python3 + `pip install debugpy`
 * Spawns: python3 -m debugpy.adapter
 *
 * Handshake (debugpy):
 *   initialize → launch (do not await yet) → initialized event →
 *   setBreakpoints → configurationDone → launch response completes
 */

const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const { DapStdioClient } = require('./stdioClient');

const resolvePython = () => process.env.ORION_PYTHON || process.env.PYTHON || 'python3';

class PythonDapAdapter extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.threadId = 1;
    this.capabilities = null;
    this._launchPromise = null;
  }

  async start({ program, cwd, args = [], env = {}, stopOnEntry = true }) {
    const absProgram = path.isAbsolute(program) ? program : path.join(cwd || process.cwd(), program);
    if (!fs.existsSync(absProgram)) {
      const err = new Error(`Program not found: ${absProgram}`);
      err.code = 'DEBUG_PROGRAM_MISSING';
      throw err;
    }

    const workCwd = cwd || path.dirname(absProgram);
    const python = resolvePython();
    this.client = new DapStdioClient({
      command: python,
      args: ['-X', 'frozen_modules=off', '-m', 'debugpy.adapter'],
      cwd: workCwd,
      env,
    });

    this.client.on('event', (msg) => this._onEvent(msg));
    this.client.on('exit', (info) => this.emit('terminated', info));
    this.client.on('error', (err) => this.emit('error', err));
    this.client.on('stderr', (text) => this.emit('output', { category: 'stderr', output: text }));
    this.client.start();

    const initialized = new Promise((resolve) => {
      this._resolveInitialized = resolve;
    });

    this.capabilities = await this.client.request('initialize', {
      clientID: 'orion-ide',
      clientName: 'Orion IDE',
      adapterID: 'python',
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsVariablePaging: false,
      supportsRunInTerminalRequest: false,
    });

    // Do not await — debugpy holds launch open until configurationDone
    this._launchPromise = this.client.request('launch', {
      name: 'Orion Python',
      type: 'python',
      request: 'launch',
      program: absProgram,
      cwd: workCwd,
      args,
      env,
      console: 'internalConsole',
      stopOnEntry: Boolean(stopOnEntry),
      justMyCode: true,
      python,
    }, 60000);

    // Surface launch failures without blocking the handshake
    this._launchPromise.catch((err) => {
      this.emit('error', err);
    });

    await Promise.race([
      initialized,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for DAP initialized')), 15000)),
    ]);

    return { adapter: 'python', program: absProgram };
  }

  _onEvent(msg) {
    const body = msg.body || {};
    if (msg.event === 'stopped') {
      this.threadId = body.threadId || this.threadId;
      this.emit('stopped', {
        reason: body.reason || 'breakpoint',
        threadId: this.threadId,
        description: body.description,
      });
    } else if (msg.event === 'continued') {
      this.emit('continued', body);
    } else if (msg.event === 'terminated' || msg.event === 'exited') {
      this.emit('terminated', body);
    } else if (msg.event === 'output') {
      this.emit('output', body);
    } else if (msg.event === 'initialized') {
      if (this._resolveInitialized) {
        this._resolveInitialized();
        this._resolveInitialized = null;
      }
      this.emit('initialized', body);
    }
  }

  async setBreakpoints(breakpoints = []) {
    const byPath = new Map();
    for (const bp of breakpoints) {
      const p = bp.path || bp.source || bp.fileId;
      if (!p || !bp.line) continue;
      if (!byPath.has(p)) byPath.set(p, []);
      byPath.get(p).push(bp);
    }

    const verified = [];
    for (const [sourcePath, bps] of byPath) {
      const abs = path.isAbsolute(sourcePath) ? sourcePath : sourcePath;
      const body = await this.client.request('setBreakpoints', {
        source: { path: abs },
        breakpoints: bps.map((b) => ({
          line: Number(b.line),
          column: b.column != null ? Number(b.column) : undefined,
          condition: b.condition || undefined,
        })),
      });
      for (const vb of body?.breakpoints || []) {
        verified.push({
          id: vb.id,
          path: abs,
          line: vb.line,
          verified: Boolean(vb.verified),
          message: vb.message,
        });
      }
    }
    return verified;
  }

  async configurationDone() {
    const body = await this.client.request('configurationDone', {});
    if (this._launchPromise) {
      try {
        await this._launchPromise;
      } catch (err) {
        // Launch may fail if debuggee already exited; keep going if we got config done
        if (!/exited|closed|disconnect/i.test(err.message || '')) throw err;
      }
      this._launchPromise = null;
    }
    return body;
  }

  async continue() {
    return this.client.request('continue', { threadId: this.threadId });
  }

  async next() {
    return this.client.request('next', { threadId: this.threadId });
  }

  async stepIn() {
    return this.client.request('stepIn', { threadId: this.threadId });
  }

  async stepOut() {
    return this.client.request('stepOut', { threadId: this.threadId });
  }

  async pause() {
    return this.client.request('pause', { threadId: this.threadId });
  }

  async stackTrace() {
    const body = await this.client.request('stackTrace', {
      threadId: this.threadId,
      startFrame: 0,
      levels: 20,
    });
    return (body?.stackFrames || []).map((f) => ({
      id: f.id,
      name: f.name,
      line: f.line,
      column: f.column || 0,
      path: f.source?.path || null,
    }));
  }

  async scopes(frameId) {
    const body = await this.client.request('scopes', { frameId });
    return body?.scopes || [];
  }

  async variables(variablesReference) {
    const body = await this.client.request('variables', { variablesReference });
    return (body?.variables || []).map((v) => ({
      name: v.name,
      value: v.value,
      type: v.type,
      variablesReference: v.variablesReference,
    }));
  }

  async stop() {
    try {
      await this.client.request('disconnect', { terminateDebuggee: true }, 5000);
    } catch { /* ignore */ }
    await this.client.dispose();
  }
}

module.exports = { PythonDapAdapter, resolvePython };
