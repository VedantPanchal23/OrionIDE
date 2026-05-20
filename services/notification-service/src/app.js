/**
 * Orion IDE â€” Notification Service
 */

require('dotenv').config();
require('./utils/validateEnv')();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../../../shared/utils/logger');
const notificationRoutes = require('./routes/notifications');
const { startHeartbeat, stopHeartbeat, sendToUser } = require('./services/sseService');
const pubsubService = require('./services/pubsubService');

const logger = createLogger('notification-service');
const app = express();
const PORT = process.env.PORT || 3006;

app.use(helmet());
app.use(cors(require('../../../shared/utils/corsConfig')));
app.options('*', cors(require('../../../shared/utils/corsConfig')));
app.use(express.json());

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service', timestamp: new Date().toISOString() });
});

app.use('/notifications', notificationRoutes);

app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found`, details: null } });
});

app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { requestId: req.requestId, error: err.message });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: process.env.NODE_ENV === 'development' ? err.message : null } });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info('Notification Service started', { port: PORT, env: process.env.NODE_ENV || 'development' });
    startHeartbeat();

    // Subscribe to Redis Pub/Sub and forward messages to SSE connections
    pubsubService.subscribe('notif:broadcast', (message) => {
      if (message.userId) {
        sendToUser(message.userId, message);
      }
    });
  });

  process.on('SIGTERM', () => { stopHeartbeat(); process.exit(0); });
  process.on('SIGINT', () => { stopHeartbeat(); process.exit(0); });
}

module.exports = app;
