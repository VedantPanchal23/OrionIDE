/**
 * Orion IDE — API Gateway JWT Validation Middleware
 *
 * Validates JWT tokens on incoming requests by calling auth-service /auth/validate.
 * Attaches decoded user info to req.user on success.
 * Forwards X-User-Id and X-User-Email headers to downstream services.
 *
 * Skipped routes (no auth required):
 *   - GET  /api/auth/google
 *   - GET  /api/auth/google/callback
 *   - GET  /health
 */

const axios = require('axios');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('api-gateway');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

// Routes that bypass JWT validation entirely
const PUBLIC_ROUTES = [
  { method: 'GET', path: '/api/auth/google' },
  { method: 'GET', path: '/api/auth/google/callback' },
  { method: 'POST', path: '/api/auth/google/callback' },
  { method: 'POST', path: '/api/auth/refresh' },
  { method: 'POST', path: '/api/auth/logout' },
  { method: 'GET', path: '/api/auth/validate' },
  { method: 'GET', path: '/api/auth/dev-login' },
  { method: 'GET', path: '/health' },
];

/**
 * Check if the current request matches a public (unauthenticated) route.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
const isPublicRoute = (req) => {
  return PUBLIC_ROUTES.some((route) => {
    const methodMatch = route.method === req.method;
    // Support prefix matching for OAuth redirects with query params
    const pathMatch = req.path === route.path || req.path.startsWith(route.path);
    return methodMatch && pathMatch;
  });
};

/**
 * Extract Bearer token from the Authorization header.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
};

/**
 * JWT authentication middleware.
 * - Extracts Bearer token from Authorization header
 * - Calls auth-service GET /auth/validate to verify
 * - On success: attaches req.user and sets forwarding headers
 * - On failure: returns 401 with AUTH_INVALID error
 */
const authMiddleware = async (req, res, next) => {
  // Skip auth for public routes
  if (isPublicRoute(req)) {
    return next();
  }

  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      error: {
        code: 'AUTH_INVALID',
        message: 'No authentication token provided',
        details: null,
      },
    });
  }

  try {
    // Validate token against auth-service
    const response = await axios.get(`${AUTH_SERVICE_URL}/auth/validate`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 5000,
    });

    const user = response.data.data;

    // Attach user to the request for downstream use
    req.user = user;

    // Set forwarding headers for downstream services
    req.headers['x-user-id'] = user.id || user.userId;
    req.headers['x-user-email'] = user.email;
    if (user.googleAccessToken) {
      req.headers['x-google-access-token'] = user.googleAccessToken;
    }

    return next();
  } catch (err) {
    // Differentiate between auth-service rejections and network errors
    if (err.response) {
      // Auth service explicitly rejected the token
      const status = err.response.status;
      const errorData = err.response.data?.error || {};

      logger.warn('Token validation rejected', {
        requestId: req.requestId,
        status,
        code: errorData.code,
      });

      return res.status(401).json({
        error: {
          code: errorData.code || 'AUTH_INVALID',
          message: errorData.message || 'Invalid or expired token',
          details: null,
        },
      });
    }

    // Auth service is unreachable — this is a gateway error, not a client error
    logger.error('Auth service unreachable', {
      requestId: req.requestId,
      error: err.message,
    });

    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Authentication service is currently unavailable',
        details: null,
      },
    });
  }
};

module.exports = { authMiddleware, isPublicRoute, extractToken };
