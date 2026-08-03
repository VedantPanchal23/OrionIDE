/**
 * Orion IDE — singleton terminal session manager
 *
 * A single PTY session (and its WebSocket) is shared across the whole app
 * so React Strict Mode's mount → unmount → mount cycle, or switching
 * between dock tabs, never tears down the shell. Callers `subscribe()` to
 * receive events (and an immediate replay of recent scrollback) and
 * `scheduleRelease()` on unmount — the socket is only really closed if no
 * one re-subscribes within a short grace window.
 */

import { createTerminalSession, destroyTerminalSession, getTerminalWsUrl } from '../services/terminalService';

const GRACE_MS = 15000;
const MAX_BUFFER_CHARS = 200000;

const state = {
  projectId: null,
  session: null,
  ws: null,
  status: 'idle', // idle | connecting | open | closed
  listeners: new Set(),
  createPromise: null,
  releaseTimer: null,
  buffer: '',
};

function emit(event) {
  state.listeners.forEach((fn) => {
    try { fn(event); } catch { /* listener error — ignore */ }
  });
}

function appendBuffer(chunk) {
  state.buffer += chunk;
  if (state.buffer.length > MAX_BUFFER_CHARS) {
    state.buffer = state.buffer.slice(state.buffer.length - MAX_BUFFER_CHARS);
  }
}

function resetState() {
  state.projectId = null;
  state.session = null;
  state.ws = null;
  state.status = 'idle';
  state.createPromise = null;
  state.buffer = '';
}

function hardClose() {
  if (state.releaseTimer) {
    clearTimeout(state.releaseTimer);
    state.releaseTimer = null;
  }
  const terminalId = state.session?.terminalId;
  if (state.ws) {
    try { state.ws.onclose = null; state.ws.close(); } catch { /* ignore */ }
  }
  if (terminalId) destroyTerminalSession(terminalId).catch(() => {});
  resetState();
}

function waitForOpen() {
  return new Promise((resolve, reject) => {
    const { ws } = state;
    if (!ws) { reject(new Error('No terminal socket')); return; }
    if (ws.readyState === WebSocket.OPEN) { resolve(state.session); return; }
    const cleanup = () => {
      ws.removeEventListener('open', onOpen);
      ws.removeEventListener('error', onError);
      ws.removeEventListener('close', onClose);
    };
    const onOpen = () => { cleanup(); resolve(state.session); };
    const onError = () => { cleanup(); reject(new Error('Terminal connection failed')); };
    const onClose = () => { cleanup(); reject(new Error('Terminal connection closed before opening')); };
    ws.addEventListener('open', onOpen);
    ws.addEventListener('error', onError);
    ws.addEventListener('close', onClose);
  });
}

/** Subscribe to terminal events. Immediately replays buffered scrollback. */
export function subscribe(handler) {
  state.listeners.add(handler);
  if (state.releaseTimer) {
    clearTimeout(state.releaseTimer);
    state.releaseTimer = null;
  }
  if (state.buffer) {
    try { handler({ type: 'replay', data: state.buffer }); } catch { /* ignore */ }
  }
  return () => { state.listeners.delete(handler); };
}

export function getStatus() { return state.status; }
export function getSession() { return state.session; }

/** Ensure a live session for this project exists; connect if needed. */
export async function ensureSession(projectId) {
  if (state.session && state.projectId === projectId && state.status !== 'closed') {
    if (state.status === 'open') return state.session;
    if (state.createPromise) return state.createPromise;
    return waitForOpen();
  }

  if (state.session && state.projectId !== projectId) {
    hardClose();
  }

  if (state.createPromise) return state.createPromise;

  state.projectId = projectId;
  state.status = 'connecting';
  state.buffer = '';

  state.createPromise = (async () => {
    const session = await createTerminalSession({ projectId, cols: 80, rows: 24 });
    state.session = session;

    const url = getTerminalWsUrl(session.terminalId, session.connectToken);
    const ws = new WebSocket(url);
    state.ws = ws;

    ws.onmessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      if (msg.type === 'connected') state.status = 'open';
      if (msg.type === 'output') appendBuffer(msg.data || '');
      emit(msg);
    };
    ws.onclose = () => {
      state.status = 'closed';
      emit({ type: 'closed' });
    };
    ws.onerror = () => {
      emit({ type: 'error', message: 'Terminal connection error' });
    };

    await waitForOpen();
    state.status = 'open';
    return session;
  })();

  try {
    return await state.createPromise;
  } finally {
    state.createPromise = null;
  }
}

function send(payload) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(payload));
  }
}

export function writeInput(data) { send({ type: 'input', data }); }
export function resize(cols, rows) { send({ type: 'resize', cols, rows }); }

/** Call on unmount. Absorbs Strict Mode / tab-switch remounts within a grace window. */
export function scheduleRelease() {
  if (state.listeners.size > 0) return;
  if (state.releaseTimer) clearTimeout(state.releaseTimer);
  state.releaseTimer = setTimeout(() => {
    if (state.listeners.size === 0) hardClose();
  }, GRACE_MS);
}

/** Force-close immediately (e.g. explicit "kill terminal" action). */
export function destroyNow() { hardClose(); }
