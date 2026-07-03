/**
 * Orion IDE — API Gateway
 *
 * Single entry point for all client requests.
 *
 * Middleware stack (order matters):
 *   1. helmet       — Security headers
 *   2. cors         — CORS (restricted to frontend origin)
 *   3. requestLogger — UUID requestId + structured logging
 *   4. globalLimiter — 100 req/min per IP baseline
 *   5. authMiddleware — JWT validation (skips public routes)
 *   6. proxy routes  — Forward to downstream services
 *
 * Routes:
 *   /health              → aggregated health check
 *   /api/auth/*           → auth-service:3001
 *   /api/drive/*          → drive-service:3002
 *   /api/editor/*         → editor-service:3003
 *   /api/execute/*        → execution-service:3004
 *   /api/agents/*         → agent-service:3005
 *   /api/notifications/*  → notification-service:3006
 */

require('dotenv').config();
require('./utils/validateEnv')();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const axios = require('axios');
const { createLogger } = require('../../../shared/utils/logger');
const { requestLogger } = require('./middleware/logger');
const { authMiddleware } = require('./middleware/auth');
const { globalLimiter } = require('./middleware/rateLimit');
const { mountAllRoutes } = require('./routes');

const logger = createLogger('api-gateway');
const app = express();
const PORT = process.env.PORT || 3000;

// ── Service URLs for health checks ──────────────────────────────────────
const SERVICE_URLS = {
  auth:          process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  drive:         process.env.DRIVE_SERVICE_URL || 'http://localhost:3002',
  editor:        process.env.EDITOR_SERVICE_URL || 'http://localhost:3003',
  execution:     process.env.EXECUTION_SERVICE_URL || 'http://localhost:3004',
  agents:        process.env.AGENT_SERVICE_URL || 'http://localhost:3005',
  notifications: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006',
  terminal:      process.env.TERMINAL_SERVICE_URL || 'http://localhost:3007',
};

// ──────────────────────────────────────────────────────────────────────────
// 1. SECURITY HEADERS
// ──────────────────────────────────────────────────────────────────────────
app.use(helmet());

// ──────────────────────────────────────────────────────────────────────────
// 2. CORS — shared config with exact origins (no wildcard)
// ──────────────────────────────────────────────────────────────────────────
const corsConfig = require('../../../shared/utils/corsConfig');
app.use(cors(corsConfig));
app.options('*', cors(corsConfig));

// ──────────────────────────────────────────────────────────────────────────
// 3. REQUEST LOGGER — generates requestId, attaches X-Request-Id
// ──────────────────────────────────────────────────────────────────────────
app.use(requestLogger);

// ──────────────────────────────────────────────────────────────────────────
// 4. GLOBAL RATE LIMITER — 100 req/min per IP
// ──────────────────────────────────────────────────────────────────────────
app.use(globalLimiter);

// ──────────────────────────────────────────────────────────────────────────
// 6. HEALTH CHECK — aggregated status of all downstream services
// ──────────────────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const services = {};
  let allOk = true;

  // Check each downstream service in parallel
  const checks = Object.entries(SERVICE_URLS).map(async ([name, url]) => {
    try {
      const response = await axios.get(`${url}/health`, { timeout: 3000 });
      services[name] = response.data.status === 'ok' ? 'ok' : 'down';
    } catch {
      services[name] = 'down';
      allOk = false;
    }
  });

  await Promise.all(checks);

  const status = allOk ? 'ok' : 'degraded';
  const statusCode = allOk ? 200 : 207; // 207 Multi-Status for partial health

  res.status(statusCode).json({
    status,
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    services,
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 7. AUTH MIDDLEWARE — JWT validation (skips public routes)
// ──────────────────────────────────────────────────────────────────────────
app.use(authMiddleware);

// ──────────────────────────────────────────────────────────────────────────
// 8. PROXY ROUTES — mount all downstream service proxies
// ──────────────────────────────────────────────────────────────────────────
mountAllRoutes(app);

// ──────────────────────────────────────────────────────────────────────────
// 9. JSON BODY PARSER — placed AFTER proxy routes so http-proxy-middleware
//    receives the raw request body stream. Only needed by non-proxy routes.
// ──────────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));

// ──────────────────────────────────────────────────────────────────────────
// 10. 404 HANDLER — unknown routes
// ──────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      details: null,
    },
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 10. GLOBAL ERROR HANDLER
// ──────────────────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
  });

  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? err.message : null,
    },
  });
});

// ──────────────────────────────────────────────────────────────────────────
// START SERVER
// ──────────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    logger.info('API Gateway started', {
      port: PORT,
      env: process.env.NODE_ENV || 'development',
      services: Object.keys(SERVICE_URLS).join(', '),
    });
  });

  // Handle WebSocket upgrades for editor-service proxy
  server.on('upgrade', (req, socket, head) => {
    logger.info('WebSocket upgrade request', { url: req.url });
  });
}

module.exports = app;
