/**
 * Orion IDE — Terminal Service (Frontend)
 *
 * Manages terminal sessions via REST API and WebSocket connections.
 */

import api from './api';

const TERMINAL_BASE = '/terminal';

/**
 * Create a new terminal session on the backend.
 * @param {{ cols?: number, rows?: number }} options
 * @returns {Promise<{ terminalId: string, shell: string }>}
 */
export async function createTerminalSession(options = {}) {
  const res = await api.post(`${TERMINAL_BASE}/sessions`, options);
  return res.data?.data;
}

/**
 * List all active terminals for the current user.
 * @returns {Promise<Array>}
 */
export async function listTerminalSessions() {
  const res = await api.get(`${TERMINAL_BASE}/sessions`);
  return res.data?.data || [];
}

/**
 * Destroy a terminal session.
 * @param {string} terminalId
 */
export async function destroyTerminalSession(terminalId) {
  await api.delete(`${TERMINAL_BASE}/sessions/${terminalId}`);
}

/**
 * Build a WebSocket URL for connecting to a terminal.
 * @param {string} terminalId
 * @returns {string}
 */
export function getTerminalWsUrl(terminalId) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/api/terminal/ws/terminal?terminalId=${encodeURIComponent(terminalId)}`;
}
