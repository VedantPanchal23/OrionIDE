/**
 * Orion IDE — Forwarded ports registry
 *
 * Tracks ports a user opens in terminal/workspace (dev servers).
 * HTTP traffic is proxied via /terminal/proxy/:port (see app.js).
 */

const net = require('net');
const { v4: uuidv4 } = require('uuid');

/** @type {Map<string, Map<string, object>>} userId → portId → record */
const userPorts = new Map();

const DEFAULT_SCAN_PORTS = [
  3000, 3001, 3010, 4000, 4200, 5000, 5173, 5500, 8000, 8080, 8888, 9000,
];

const listPorts = (userId) => {
  const map = userPorts.get(userId);
  if (!map) return [];
  return [...map.values()];
};

const isRegistered = (userId, port) => {
  const p = Number(port);
  return listPorts(userId).some((rec) => rec.port === p);
};

const registerPort = (userId, { port, label, protocol = 'http', projectId = null }) => {
  const p = Number(port);
  if (!Number.isInteger(p) || p < 1 || p > 65535) {
    const err = new Error('Invalid port');
    err.code = 'PORTS_INVALID';
    err.status = 400;
    throw err;
  }

  const proto = String(protocol || 'http').toLowerCase();
  if (proto !== 'http' && proto !== 'https') {
    const err = new Error('Protocol must be http or https');
    err.code = 'PORTS_INVALID_PROTOCOL';
    err.status = 400;
    throw err;
  }

  if (!userPorts.has(userId)) userPorts.set(userId, new Map());
  const map = userPorts.get(userId);

  for (const [id, rec] of map) {
    if (rec.port === p) {
      map.delete(id);
    }
  }

  const id = uuidv4();
  const record = {
    id,
    userId,
    port: p,
    label: label || `Port ${p}`,
    protocol: proto,
    projectId,
    publicPath: `/api/terminal/proxy/${p}/`,
    createdAt: new Date().toISOString(),
  };
  map.set(id, record);
  return record;
};

const unregisterPort = (userId, portIdOrNumber) => {
  const map = userPorts.get(userId);
  if (!map) return false;
  if (map.has(portIdOrNumber)) {
    map.delete(portIdOrNumber);
    return true;
  }
  const asNum = Number(portIdOrNumber);
  for (const [id, rec] of map) {
    if (rec.port === asNum || rec.id === portIdOrNumber) {
      map.delete(id);
      return true;
    }
  }
  return false;
};

const clearUser = (userId) => {
  userPorts.delete(userId);
};

/**
 * TCP connect probe — true if something accepts connections on host:port.
 */
function probePort(port, host = '127.0.0.1', timeoutMs = 250) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch { /* ignore */ }
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/**
 * Scan common + registered + extra ports for listeners on localhost.
 * @returns {Promise<Array<{ port: number, host: string }>>}
 */
async function detectListeningPorts(userId, extraPorts = []) {
  const registered = listPorts(userId).map((r) => r.port);
  const extras = (Array.isArray(extraPorts) ? extraPorts : [])
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 65535);
  const candidates = [...new Set([...DEFAULT_SCAN_PORTS, ...registered, ...extras])];

  const hits = await Promise.all(
    candidates.map(async (port) => {
      const ok = await probePort(port);
      return ok ? { port, host: '127.0.0.1' } : null;
    }),
  );
  return hits.filter(Boolean).sort((a, b) => a.port - b.port);
}

module.exports = {
  listPorts,
  registerPort,
  unregisterPort,
  clearUser,
  isRegistered,
  probePort,
  detectListeningPorts,
  DEFAULT_SCAN_PORTS,
};
