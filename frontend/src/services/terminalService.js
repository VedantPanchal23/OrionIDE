import api, { getAccessToken } from './api';

export async function createTerminalSession(options = {}) {
  const res = await api.post('/terminal/sessions', options);
  return res.data?.data;
}

export async function listTerminalSessions() {
  const res = await api.get('/terminal/sessions');
  return res.data?.data || [];
}

export async function destroyTerminalSession(terminalId) {
  await api.delete(`/terminal/sessions/${terminalId}`);
}

export async function syncTerminalSession(terminalId, mode = 'push') {
  const res = await api.post(`/terminal/sessions/${terminalId}/sync`, { mode });
  return res.data?.data;
}

/**
 * Build terminal WS URL.
 * In Vite DEV, prefer the terminal-service port directly — the API gateway
 * http-proxy WS path frequently yields open→1006 drops (no frames).
 * Override with VITE_WS_HOST (e.g. localhost:3000) to force the gateway.
 */
export function getTerminalWsUrl(terminalId, connectToken) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const q = new URLSearchParams({ terminalId: terminalId || '' });
  const ptyToken = connectToken || '';

  if (import.meta.env.DEV) {
    const configured = import.meta.env.VITE_WS_HOST;
    if (!configured) {
      // Direct to terminal-service. It authenticates with the PTY connect token
      // via `token` (or `connectToken`) — do NOT send the JWT as `token`.
      q.set('token', ptyToken);
      q.set('connectToken', ptyToken);
      return `${proto}://${window.location.hostname}:3007/terminal/ws/terminal?${q.toString()}`;
    }
    q.set('connectToken', ptyToken);
    const access = getAccessToken();
    if (access) q.set('token', access);
    return `${proto}://${configured}/api/terminal/ws?${q.toString()}`;
  }

  q.set('connectToken', ptyToken);
  const access = getAccessToken();
  if (access) q.set('token', access);
  return `${proto}://${window.location.host}/api/terminal/ws?${q.toString()}`;
}

export async function listPorts({ detect = false } = {}) {
  const res = await api.get('/terminal/ports', {
    params: detect ? { detect: 1 } : undefined,
  });
  const data = res.data?.data || {};
  if (detect) {
    return {
      ports: data.ports || [],
      listening: data.listening || [],
    };
  }
  return data.ports || [];
}

export async function detectPorts() {
  const res = await api.get('/terminal/ports/detect');
  return res.data?.data?.listening || [];
}

export async function registerPort(body) {
  const res = await api.post('/terminal/ports', body);
  return res.data?.data;
}

export async function unregisterPort(id) {
  const res = await api.delete(`/terminal/ports/${encodeURIComponent(id)}`);
  return res.data?.data;
}
