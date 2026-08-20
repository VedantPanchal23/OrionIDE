/**
 * Multi-session terminal manager for the active project.
 * ensureSession() keeps a primary session for Drive sync / git.
 */

import {
  createTerminalSession,
  destroyTerminalSession,
  listTerminalSessions,
  getTerminalWsUrl,
  syncTerminalSession,
} from '../services/terminalService';

const state = {
  projectId: null,
  sessions: [], // { terminalId, connectToken, title }
  activeTerminalId: null,
  createPromise: null,
  listeners: new Set(),
};

function emit(event) {
  state.listeners.forEach((fn) => {
    try { fn(event); } catch { /* ignore */ }
  });
}

function snapshot() {
  return {
    projectId: state.projectId,
    sessions: [...state.sessions],
    activeTerminalId: state.activeTerminalId,
  };
}

function toPublic(session) {
  if (!session) return null;
  return {
    ...session,
    wsUrl: getTerminalWsUrl(session.terminalId, session.connectToken),
  };
}

async function destroyAll() {
  const ids = state.sessions.map((s) => s.terminalId);
  state.sessions = [];
  state.activeTerminalId = null;
  await Promise.all(ids.map(async (id) => {
    try { await destroyTerminalSession(id); } catch { /* ignore */ }
  }));
}

export function subscribe(fn) {
  state.listeners.add(fn);
  fn({ type: 'snapshot', ...snapshot() });
  return () => state.listeners.delete(fn);
}

export function getSessions() {
  return state.sessions.map(toPublic);
}

export function getActiveSession() {
  const s = state.sessions.find((x) => x.terminalId === state.activeTerminalId)
    || state.sessions[0]
    || null;
  return toPublic(s);
}

export function setActiveSession(terminalId) {
  if (!state.sessions.some((s) => s.terminalId === terminalId)) return;
  state.activeTerminalId = terminalId;
  emit({ type: 'active', terminalId, ...snapshot() });
}

export function renameSession(terminalId, title) {
  const s = state.sessions.find((x) => x.terminalId === terminalId);
  if (!s) return;
  const next = String(title || '').trim();
  if (!next) return;
  s.title = next;
  emit({ type: 'renamed', terminalId, ...snapshot() });
}

/**
 * Create a new terminal session (respects maxTerminals).
 * If the backend still holds orphaned sessions from prior tabs, reclaim them.
 */
export async function createSession(projectId, { title, maxTerminals = 2 } = {}) {
  if (!projectId) throw new Error('projectId required');

  if (state.projectId && state.projectId !== projectId) {
    await destroyAll();
  }
  state.projectId = projectId;

  const limit = Math.max(1, Number(maxTerminals) || 2);
  if (state.sessions.length >= limit) {
    const err = new Error(`Terminal limit reached (${limit})`);
    err.code = 'TERM_LIMIT';
    throw err;
  }

  let data;
  try {
    data = await createTerminalSession({ projectFolderId: projectId });
  } catch (err) {
    const code = err?.response?.data?.error?.code || err?.code;
    if (code !== 'TERMINAL_LIMIT_EXCEEDED') throw err;
    // Orphaned backend sessions (other tabs / crashed clients) — free room then retry.
    const remote = await listTerminalSessions().catch(() => []);
    const keep = new Set(state.sessions.map((s) => s.terminalId));
    for (const s of remote) {
      const id = s.terminalId || s.id;
      if (!id || keep.has(id)) continue;
      try { await destroyTerminalSession(id); } catch { /* ignore */ }
    }
    data = await createTerminalSession({ projectFolderId: projectId });
  }

  const session = {
    terminalId: data.terminalId,
    connectToken: data.connectToken,
    title: title || `Terminal ${state.sessions.length + 1}`,
  };
  state.sessions.push(session);
  state.activeTerminalId = session.terminalId;
  emit({ type: 'created', terminalId: session.terminalId, ...snapshot() });
  return toPublic(session);
}

/**
 * Ensure at least one session exists for project (used by sync/git/debug).
 */
export async function ensureSession(projectId, { maxTerminals = 2 } = {}) {
  if (!projectId) throw new Error('projectId required');

  if (state.projectId === projectId && state.sessions.length > 0) {
    return getActiveSession();
  }

  if (state.createPromise && state.projectId === projectId) {
    return state.createPromise;
  }

  if (state.projectId && state.projectId !== projectId) {
    await destroyAll();
  }

  state.projectId = projectId;
  state.createPromise = createSession(projectId, {
    title: 'Terminal 1',
    maxTerminals,
  }).finally(() => {
    state.createPromise = null;
  });

  return state.createPromise;
}

export async function closeSession(terminalId) {
  const idx = state.sessions.findIndex((s) => s.terminalId === terminalId);
  if (idx === -1) return snapshot();

  const [removed] = state.sessions.splice(idx, 1);
  try { await destroyTerminalSession(removed.terminalId); } catch { /* ignore */ }

  if (state.activeTerminalId === terminalId) {
    const next = state.sessions[idx] || state.sessions[idx - 1] || state.sessions[0] || null;
    state.activeTerminalId = next?.terminalId || null;
  }

  emit({ type: 'closed', terminalId, ...snapshot() });
  return snapshot();
}

export async function syncWithDrive(mode = 'push') {
  const active = getActiveSession();
  if (!active?.terminalId) throw new Error('No active terminal session');
  const result = await syncTerminalSession(active.terminalId, mode);
  emit({ type: 'synced', mode, result });
  return result;
}

export function getWsUrl() {
  return getActiveSession()?.wsUrl || null;
}
