/**
 * Orion IDE — Forwarded ports registry
 *
 * Tracks ports a user opens in terminal/workspace (dev servers).
 * Actual TCP proxying can be layered later; this is the control plane.
 */

const { v4: uuidv4 } = require('uuid');

/** @type {Map<string, Map<string, object>>} userId → portId → record */
const userPorts = new Map();

const listPorts = (userId) => {
  const map = userPorts.get(userId);
  if (!map) return [];
  return [...map.values()];
};

const registerPort = (userId, { port, label, protocol = 'http', projectId = null }) => {
  const p = Number(port);
  if (!Number.isInteger(p) || p < 1 || p > 65535) {
    const err = new Error('Invalid port');
    err.code = 'PORTS_INVALID';
    err.status = 400;
    throw err;
  }

  if (!userPorts.has(userId)) userPorts.set(userId, new Map());
  const map = userPorts.get(userId);

  // One registration per port number per user
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
    protocol,
    projectId,
    publicPath: `/proxy/${userId}/${p}`,
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

module.exports = { listPorts, registerPort, unregisterPort, clearUser };
