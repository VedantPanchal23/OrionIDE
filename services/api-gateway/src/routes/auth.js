/**
 * Orion IDE — API Gateway Auth Routes
 *
 * Proxies /api/auth/* → auth-service:3001
 * Auth routes bypass JWT validation (handled by isPublicRoute for google/callback).
 * Forwards X-Request-Id to auth-service.
 */

const { createProxyMiddleware } = require('http-proxy-middleware');
const { authLimiter } = require('../middleware/rateLimit');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

const authProxy = createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  cookieDomainRewrite: '', // rewrite cookie domain to match gateway
  cookiePathRewrite: { '/auth': '/' }, // auth-service sets path=/auth, rewrite to /
  pathRewrite: {
    '^/': '/auth/', // Express strips /api/auth, so /google → /auth/google
  },
  on: {
    proxyReq: (proxyReq, req) => {
      // Forward tracking headers
      if (req.requestId) {
        proxyReq.setHeader('X-Request-Id', req.requestId);
      }
      // Forward user headers if user is authenticated (e.g., /auth/me, /auth/logout)
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.id || req.user.userId || '');
        proxyReq.setHeader('X-User-Email', req.user.email || '');
      }
    },
    error: (err, req, res) => {
      res.status(502).json({
        error: {
          code: 'GATEWAY_UPSTREAM_ERROR',
          message: 'Auth service is unreachable',
          details: process.env.NODE_ENV === 'development' ? err.message : null,
        },
      });
    },
  },
});

/**
 * Mount auth routes on an Express router.
 * @param {import('express').Application} app
 */
const mountAuthRoutes = (app) => {
  app.use('/api/auth', authLimiter, authProxy);
};

module.exports = { mountAuthRoutes };
