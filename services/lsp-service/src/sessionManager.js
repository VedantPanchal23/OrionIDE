/**
 * Spawn a language server and bridge WebSocket ↔ stdio JSON-RPC.
 */

const { spawn } = require('child_process');
const { getCandidates } = require('./servers');
const { createStreamFramer, encodeMessage } = require('./framing');
const {
  ensureProjectRoot, virtualRootUri, materializeDocument, uriToDiskPath,
} = require('./workspace');

class LspSession {
  /**
   * @param {object} opts
   * @param {import('ws')} opts.ws
   * @param {string} opts.userId
   * @param {string} opts.projectId
   * @param {string} opts.language
   */
  constructor({ ws, userId, projectId, language }) {
    this.ws = ws;
    this.userId = userId;
    this.projectId = projectId;
    this.language = language;
    this.child = null;
    this.alive = true;
    this.root = ensureProjectRoot(userId, projectId);
    this.rootUri = virtualRootUri(projectId);
  }

  async start() {
    const candidates = getCandidates(this.language);
    if (!candidates.length) {
      this.sendClient({
        jsonrpc: '2.0',
        method: 'window/showMessage',
        params: {
          type: 2,
          message: `No language server configured for "${this.language}". Using editor catalogs only.`,
        },
      });
      this.sendClient({
        jsonrpc: '2.0',
        method: '$/orion/serverStatus',
        params: { status: 'unavailable', language: this.language },
      });
      return false;
    }

    let lastErr = null;
    for (const cand of candidates) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.spawnServer(cand);
        this.sendClient({
          jsonrpc: '2.0',
          method: '$/orion/serverStatus',
          params: {
            status: 'ready',
            language: this.language,
            command: cand.command,
            rootUri: this.rootUri,
            cwd: this.root,
          },
        });
        return true;
      } catch (err) {
        lastErr = err;
      }
    }

    this.sendClient({
      jsonrpc: '2.0',
      method: '$/orion/serverStatus',
      params: {
        status: 'error',
        language: this.language,
        message: lastErr?.message || 'Failed to start language server',
      },
    });
    return false;
  }

  spawnServer(cand) {
    return new Promise((resolve, reject) => {
      const child = spawn(cand.command, cand.args || [], {
        cwd: this.root,
        env: { ...process.env, ...(cand.env || {}) },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: Boolean(cand.shell),
        windowsHide: true,
      });

      let settled = false;
      const settleMs = cand.shell || /npx/i.test(cand.command) ? 1500 : 400;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        try { child.kill(); } catch { /* ignore */ }
        reject(err);
      };

      child.on('error', (err) => fail(err));
      child.stderr.on('data', (buf) => {
        const text = buf.toString();
        if (process.env.LSP_DEBUG) {
          // eslint-disable-next-line no-console
          console.warn(`[lsp:${this.language}]`, text.slice(0, 500));
        }
      });

      child.stdin.on('error', (err) => fail(err));
      setTimeout(() => {
        if (settled) return;
        if (child.killed || child.exitCode != null) {
          fail(new Error(`Language server exited early (${cand.command})`));
          return;
        }
        settled = true;
        this.child = child;
        this.attachPipes();
        resolve();
      }, settleMs);

      child.on('exit', (code) => {
        if (!this.alive) return;
        this.sendClient({
          jsonrpc: '2.0',
          method: '$/orion/serverStatus',
          params: { status: 'exited', code, language: this.language },
        });
        try { this.ws.close(); } catch { /* ignore */ }
      });
    });
  }

  attachPipes() {
    const framer = createStreamFramer((msg) => {
      // Rewrite file URIs in diagnostics etc. stay as virtual URIs (already virtual from client).
      this.sendClient(msg);
    });
    this.child.stdout.on('data', (chunk) => framer.push(chunk));
  }

  sendClient(msg) {
    if (this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** Client → language server */
  handleClientMessage(raw) {
    if (!this.child?.stdin?.writable) return;
    let msg;
    try {
      msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return;
    }

    // Materialize documents on didOpen / didChange so disk-based servers see content
    try {
      if (msg?.method === 'textDocument/didOpen') {
        const doc = msg.params?.textDocument;
        if (doc?.uri) materializeDocument(this.userId, this.projectId, doc.uri, doc.text);
      }
      if (msg?.method === 'textDocument/didChange') {
        const uri = msg.params?.textDocument?.uri;
        const changes = msg.params?.contentChanges;
        if (uri && Array.isArray(changes) && changes.length) {
          const last = changes[changes.length - 1];
          if (typeof last.text === 'string' && last.range == null) {
            materializeDocument(this.userId, this.projectId, uri, last.text);
          }
        }
      }
      // Inject workspace root into initialize if client omitted it
      if (msg?.method === 'initialize') {
        msg.params = msg.params || {};
        msg.params.rootUri = msg.params.rootUri || this.rootUri;
        msg.params.workspaceFolders = msg.params.workspaceFolders || [
          { uri: this.rootUri, name: this.projectId },
        ];
        msg.params.capabilities = msg.params.capabilities || {};
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[lsp] materialize failed:', err.message);
    }

    this.child.stdin.write(encodeMessage(msg));
  }

  dispose() {
    this.alive = false;
    if (this.child && !this.child.killed) {
      try {
        this.child.stdin.write(encodeMessage({ jsonrpc: '2.0', method: 'exit' }));
      } catch { /* ignore */ }
      try { this.child.kill(); } catch { /* ignore */ }
    }
    this.child = null;
  }
}

module.exports = { LspSession };
