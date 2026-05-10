/**
 * Orion IDE â€” Execution Service
 */

require('dotenv').config();
require('./utils/validateEnv')();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../../../shared/utils/logger');
const executeRoutes = require('./routes/execute');

const logger = createLogger('execution-service');
const app = express();
const PORT = process.env.PORT || 3004;

app.use(helmet());
app.use(cors(require('../../../shared/utils/corsConfig')));
app.options('*', cors(require('../../../shared/utils/corsConfig')));
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'execution-service', timestamp: new Date().toISOString() });
});

app.use('/execute', executeRoutes);

app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found`, details: null } });
});

app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { requestId: req.requestId, error: err.message });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: process.env.NODE_ENV === 'development' ? err.message : null } });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info('Execution Service started', { port: PORT, env: process.env.NODE_ENV || 'development' });
  });
}

module.exports = app;
