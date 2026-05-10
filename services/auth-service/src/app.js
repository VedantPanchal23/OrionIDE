/**
 * Orion IDE â€” Auth Service
 *
 * Handles Google OAuth 2.0 authentication, JWT issuance,
 * token refresh, and user identity management.
 *
 * Endpoints:
 *   GET  /auth/google           â€” Initiate Google OAuth flow
 *   GET  /auth/google/callback  â€” Google OAuth callback, issues tokens
 *   POST /auth/refresh          â€” Refresh access token (uses httpOnly cookie)
 *   POST /auth/logout           â€” Revoke refresh token, clear cookie
 *   GET  /auth/me               â€” Get current user info
 *   GET  /auth/validate         â€” Validate JWT (used by API Gateway)
 *   GET  /health                â€” Service health check
 */

require('dotenv').config();
require('./utils/validateEnv')();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../../../shared/utils/logger');
const { configurePassport } = require('./services/googleService');
const authRoutes = require('./routes/auth');

const logger = createLogger('auth-service');
const app = express();
const PORT = process.env.PORT || 3001;

// â”€â”€ Middleware Stack â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(helmet());
app.use(cors(require('../../../../shared/utils/corsConfig')));
app.options('*', cors(require('../../../../shared/utils/corsConfig')));
app.use(express.json());
app.use(cookieParser());

// Initialize Passport (no sessions â€” we use JWTs)
configurePassport();
app.use(passport.initialize());

// Attach request ID (forward X-Request-Id from API Gateway if present)
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// â”€â”€ Health Check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
  });
});

// â”€â”€ Auth Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use('/auth', authRoutes);

// â”€â”€ 404 Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      details: null,
    },
  });
});

// â”€â”€ Global Error Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
  });
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? err.message : null,
    },
  });
});

// â”€â”€ Start Server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info('Auth Service started', {
      port: PORT,
      env: process.env.NODE_ENV || 'development',
    });
  });
}

module.exports = app;
