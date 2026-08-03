/**
 * DAP client over a child process stdio (Content-Length framed JSON).
 */

const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const { DapFramer } = require('./framing');

class DapStdioClient extends EventEmitter {
  constructor({ command, args = [], env = {}, cwd = undefined }) {
    super();
    this.command = command;
    this.args = args;
    this.env = env;
    this.cwd = cwd;
    this.seq = 1;
    this.pending = new Map();
    this.framer = new DapFramer();
    this.proc = null;
    this.closed = false;
  }

  start() {
    if (this.proc) return;
    this.proc = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: { ...process.env, ...this.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.proc.stdout.on('data', (chunk) => {
      for (const msg of this.framer.feed(chunk)) {
        this._handleMessage(msg);
      }
    });

    this.proc.stderr.on('data', (chunk) => {
      this.emit('stderr', chunk.toString('utf8'));
    });

    this.proc.on('exit', (code, signal) => {
      this.closed = true;
      for (const [, { reject }] of this.pending) {
        reject(new Error(`DAP adapter exited (code=${code}, signal=${signal})`));
      }
      this.pending.clear();
      this.emit('exit', { code, signal });
    });

    this.proc.on('error', (err) => {
      this.emit('error', err);
    });
  }

  _handleMessage(msg) {
    if (msg.type === 'event') {
      this.emit('event', msg);
      this.emit(msg.event, msg.body || {});
      return;
    }
    if (msg.type === 'response' && msg.request_seq != null) {
      const pending = this.pending.get(msg.request_seq);
      if (!pending) return;
      this.pending.delete(msg.request_seq);
      if (msg.success === false) {
        const err = new Error(msg.message || 'DAP request failed');
        err.body = msg.body;
        pending.reject(err);
      } else {
        pending.resolve(msg.body);
      }
    }
  }

  request(command, args = {}, timeoutMs = 30000) {
    if (this.closed || !this.proc) {
      return Promise.reject(new Error('DAP adapter is not running'));
    }
    const seq = this.seq++;
    const message = {
      seq,
      type: 'request',
      command,
      arguments: args,
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error(`DAP request timed out: ${command}`));
      }, timeoutMs);

      this.pending.set(seq, {
        resolve: (body) => {
          clearTimeout(timer);
          resolve(body);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      try {
        this.proc.stdin.write(this.framer.encode(message));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(seq);
        reject(err);
      }
    });
  }

  async dispose() {
    if (!this.proc) return;
    try {
      this.proc.stdin.end();
    } catch { /* ignore */ }
    try {
      this.proc.kill('SIGTERM');
    } catch { /* ignore */ }
    this.proc = null;
    this.closed = true;
  }
}

module.exports = { DapStdioClient };
