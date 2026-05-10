/**
 * Orion IDE — API Gateway Drive Routes
 *
 * Proxies /api/drive/* → drive-service:3002
 * All routes require authentication (handled by auth middleware).
 * Forwards X-User-Id, X-User-Email, X-Request-Id headers.
 */

const { createProxyMiddleware } = require('http-proxy-middleware');

const DRIVE_SERVICE_URL = process.env.DRIVE_SERVICE_URL || 'http://localhost:3002';

const driveProxy = createProxyMiddleware({
  target: DRIVE_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/': '/drive/', // Express strips /api/drive, so /files → /drive/files
  },
  on: {
    proxyReq: (proxyReq, req) => {
      if (req.requestId) {
        proxyReq.setHeader('X-Request-Id', req.requestId);
      }
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.id || req.user.userId || '');
        proxyReq.setHeader('X-User-Email', req.user.email || '');
        if (req.user.googleAccessToken) {
          proxyReq.setHeader('X-Google-Access-Token', req.user.googleAccessToken);
        }
      }
    },
    error: (err, req, res) => {
      res.status(502).json({
        error: {
          code: 'GATEWAY_UPSTREAM_ERROR',
          message: 'Drive service is unreachable',
          details: process.env.NODE_ENV === 'development' ? err.message : null,
        },
      });
    },
  },
});

const mountDriveRoutes = (app) => {
  app.use('/api/drive', driveProxy);
};

module.exports = { mountDriveRoutes };
