/**
 * Minimal JSON-RPC 2.0 client over WebSocket for Orion LSP bridge.
 */

export class LspJsonRpcClient {
  constructor() {
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.statusHandlers = new Set();
    this.ready = false;
    this.status = { status: 'idle' };
  }

  onNotification(method, handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, new Set());
    this.handlers.get(method).add(handler);
    return () => this.handlers.get(method)?.delete(handler);
  }

  onStatus(handler) {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  setStatus(status) {
    this.status = status;
    this.statusHandlers.forEach((h) => {
      try { h(status); } catch { /* ignore */ }
    });
  }

  connect(url) {
    this.dispose();
    this.setStatus({ status: 'connecting' });
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      let opened = false;

      ws.onopen = () => {
        opened = true;
        this.ready = true;
        this.setStatus({ status: 'connected' });
        resolve();
      };
      ws.onerror = () => {
        if (!opened) reject(new Error('LSP WebSocket failed'));
      };
      ws.onclose = () => {
        this.ready = false;
        this.setStatus({ status: 'closed' });
        this.pending.forEach(({ reject: rej }) => rej(new Error('LSP connection closed')));
        this.pending.clear();
      };
      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        this.dispatch(msg);
      };
    });
  }

  dispatch(msg) {
    if (msg.id != null && (msg.result !== undefined || msg.error !== undefined)) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.error) pending.reject(Object.assign(new Error(msg.error.message || 'LSP error'), { lsp: msg.error }));
      else pending.resolve(msg.result);
      return;
    }
    if (msg.method) {
      if (msg.method === '$/orion/serverStatus') {
        this.setStatus(msg.params || {});
      }
      const set = this.handlers.get(msg.method);
      if (set) set.forEach((h) => { try { h(msg.params); } catch { /* ignore */ } });
      // Respond to server requests that need an answer
      if (msg.id != null && msg.method === 'workspace/configuration') {
        this.sendNotificationResponse(msg.id, []);
      }
      if (msg.id != null && msg.method === 'window/workDoneProgress/create') {
        this.sendNotificationResponse(msg.id, null);
      }
      if (msg.id != null && msg.method === 'client/registerCapability') {
        this.sendNotificationResponse(msg.id, null);
      }
      if (msg.id != null && msg.method === 'workspace/workspaceFolders') {
        this.sendNotificationResponse(msg.id, null);
      }
    }
  }

  sendNotificationResponse(id, result) {
    this.sendRaw({ jsonrpc: '2.0', id, result });
  }

  sendRaw(msg) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  request(method, params, timeoutMs = 20000) {
    const id = this.nextId++;
    const payload = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`LSP timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.sendRaw(payload);
    });
  }

  notify(method, params) {
    this.sendRaw({ jsonrpc: '2.0', method, params });
  }

  dispose() {
    try { this.ws?.close(); } catch { /* ignore */ }
    this.ws = null;
    this.ready = false;
    this.pending.forEach(({ reject }) => reject(new Error('disposed')));
    this.pending.clear();
  }
}
