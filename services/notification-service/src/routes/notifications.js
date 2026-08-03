/**
 * Orion IDE — Notification Routes
 */

const express = require('express');
const { addConnection, sendToUser, sendToAll, getStats } = require('../services/sseService');
const { publishToUser, publishBroadcast } = require('../services/pubsubService');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('notification-service');
const router = express.Router();

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
if (!INTERNAL_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('INTERNAL_SECRET is required in production');
}
const RESOLVED_INTERNAL_SECRET = INTERNAL_SECRET || 'orion-internal-secret-dev';

// GET /notifications/stream — SSE endpoint
router.get('/stream', (req, res) => {
  // Only trust gateway-injected identity — never client-supplied ?userId=
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: { code: 'NOTIF_NO_AUTH', message: 'Missing user context', details: null } });
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const connectionId = addConnection(userId, res);

  // Send connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ connectionId, userId })}\n\n`);

  logger.info('SSE stream opened', { userId, connectionId });
});

// POST /notifications/publish — internal-only event publish
router.post('/publish', (req, res) => {
  const secret = req.headers['x-internal-secret'];
  if (secret !== RESOLVED_INTERNAL_SECRET) {
    return res.status(403).json({ error: { code: 'NOTIF_FORBIDDEN', message: 'Invalid internal secret', details: null } });
  }

  const { type, userId, payload, broadcast } = req.body;
  if (!type) {
    return res.status(400).json({ error: { code: 'NOTIF_MISSING_PARAM', message: 'type is required', details: null } });
  }

  const event = { type, userId, payload, timestamp: new Date().toISOString() };

  try {
    if (broadcast) {
      const sent = sendToAll(event);
      publishBroadcast(event).catch(() => {});
      res.json({ data: { sent, broadcast: true } });
    } else if (userId) {
      const sent = sendToUser(userId, event);
      publishToUser(userId, event).catch(() => {});
      res.json({ data: { sent, userId } });
    } else {
      return res.status(400).json({ error: { code: 'NOTIF_MISSING_PARAM', message: 'userId or broadcast required', details: null } });
    }
  } catch (err) {
    logger.error('Publish failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// GET /notifications/health — basic liveness (no sensitive data)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service', timestamp: new Date().toISOString() });
});

module.exports = router;
