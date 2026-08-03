/**
 * Orion IDE — Terminal Service (Frontend)
 */

import api from './api';

const TERMINAL_BASE = '/terminal';

export async function createTerminalSession(options = {}) {
  const res = await api.post(`${TERMINAL_BASE}/sessions`, options);
  return res.data?.data;
}

export async function listTerminalSessions() {
  const res = await api.get(`${TERMINAL_BASE}/sessions`);
  return res.data?.data || [];
}

export async function destroyTerminalSession(terminalId) {
  await api.delete(`${TERMINAL_BASE}/sessions/${terminalId}`);
}

/**
 * Prefer direct gateway in dev — Vite's WS proxy aborts upgrades (ECONNABORTED).
 * Override with VITE_API_WS_HOST if needed.
 */
export function getTerminalWsUrl(terminalId, connectToken) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const isDev = Boolean(import.meta.env?.DEV);
  const host = import.meta.env?.VITE_API_WS_HOST
    || (isDev ? 'localhost:3000' : window.location.host);
  const tokenQs = connectToken ? `&token=${encodeURIComponent(connectToken)}` : '';
  return `${protocol}//${host}/api/terminal/ws/terminal?terminalId=${encodeURIComponent(terminalId)}${tokenQs}`;
}
