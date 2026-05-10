/**
 * Orion IDE — SSE Connection Manager
 *
 * Manages active SSE connections per user.
 * Sends heartbeats every 15s to keep connections alive.
 */

const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('notification-service');

// Map<userId, Map<connectionId, res>>
const connections = new Map();

const HEARTBEAT_INTERVAL = 15000;

/**
 * Add an SSE connection for a user.
 */
const addConnection = (userId, res) => {
  const connectionId = uuidv4();

  if (!connections.has(userId)) {
    connections.set(userId, new Map());
  }
  connections.get(userId).set(connectionId, res);

  logger.info('SSE connection added', { userId, connectionId, total: connections.get(userId).size });

  // Remove on client disconnect
  res.on('close', () => {
    removeConnection(userId, connectionId);
  });

  return connectionId;
};

/**
 * Remove an SSE connection.
 */
const removeConnection = (userId, connectionId) => {
  const userConns = connections.get(userId);
  if (userConns) {
    userConns.delete(connectionId);
    if (userConns.size === 0) {
      connections.delete(userId);
    }
  }
  logger.debug('SSE connection removed', { userId, connectionId });
};

/**
 * Send an event to all SSE connections for a specific user.
 */
const sendToUser = (userId, event) => {
  const userConns = connections.get(userId);
  if (!userConns || userConns.size === 0) return 0;

  const data = typeof event === 'string' ? event : JSON.stringify(event);
  const eventType = event.type || 'message';
  let sent = 0;

  userConns.forEach((res) => {
    try {
      res.write(`event: ${eventType}\ndata: ${data}\n\n`);
      sent++;
    } catch {
      // Connection broken — will be cleaned up by close handler
    }
  });

  return sent;
};

/**
 * Broadcast an event to all connected users.
 */
const sendToAll = (event) => {
  let totalSent = 0;
  connections.forEach((_, userId) => {
    totalSent += sendToUser(userId, event);
  });
  return totalSent;
};

/**
 * Get total connection count.
 */
const getStats = () => {
  let totalConnections = 0;
  connections.forEach((conns) => { totalConnections += conns.size; });
  return { users: connections.size, connections: totalConnections };
};

// ── Heartbeat ───────────────────────────────────────────────────────────
let heartbeatInterval = null;

const startHeartbeat = () => {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    connections.forEach((userConns) => {
      userConns.forEach((res) => {
        try {
          res.write(': heartbeat\n\n');
        } catch {
          // Broken connection
        }
      });
    });
  }, HEARTBEAT_INTERVAL);
  logger.info('SSE heartbeat started', { intervalMs: HEARTBEAT_INTERVAL });
};

const stopHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

module.exports = {
  addConnection,
  removeConnection,
  sendToUser,
  sendToAll,
  getStats,
  startHeartbeat,
  stopHeartbeat,
  // For testing
  _connections: connections,
};
