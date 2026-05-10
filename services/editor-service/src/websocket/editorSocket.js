/**
 * Orion IDE — Editor WebSocket Server
 *
 * Foundation for V2 real-time collaboration.
 * For now: validates JWT from query param, echo server.
 */

const { WebSocketServer } = require('ws');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('editor-service');

const setupWebSocket = (server) => {
  const wss = new WebSocketServer({ server, path: '/ws/editor' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const userId = req.headers['x-user-id'] || 'anonymous';

    logger.info('WebSocket connected', { userId, hasToken: !!token });

    ws.userId = userId;
    ws.isAlive = true;

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        logger.debug('WebSocket message', { userId, type: message.type });
        // Echo back (V2: will broadcast to collaborators)
        ws.send(JSON.stringify({ type: 'echo', data: message, timestamp: Date.now() }));
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }
    });

    ws.on('close', () => {
      logger.info('WebSocket disconnected', { userId });
    });

    ws.send(JSON.stringify({ type: 'connected', userId, timestamp: Date.now() }));
  });

  // Heartbeat: ping every 30s, terminate dead connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  logger.info('WebSocket server started', { path: '/ws/editor' });
  return wss;
};

module.exports = { setupWebSocket };
