/**
 * Orion IDE — API Gateway Auth Routes
 *
 * Proxies /api/auth/* → auth-service:3001
 */

const { createProxyMiddleware } = require('http-proxy-middleware');
const { authLimiter, authStartLimiter } = require('../middleware/rateLimit');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

const authProxy = createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  cookieDomainRewrite: '',
  cookiePathRewrite: { '/auth': '/' },
  pathRewrite: {
    '^/': '/auth/',
  },
  on: {
    proxyReq: (proxyReq, req) => {
      if (req.requestId) {
        proxyReq.setHeader('X-Request-Id', req.requestId);
      }
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

const mountAuthRoutes = (app) => {
  // Strict limit only on OAuth kickoff
  app.use('/api/auth/google', (req, res, next) => {
    // Don't apply start limiter to /google/callback (path starts with /google)
    if (req.path === '/' || req.path === '') {
      return authStartLimiter(req, res, next);
    }
    return next();
  });
  app.use('/api/auth', authLimiter, authProxy);
};

module.exports = { mountAuthRoutes };
