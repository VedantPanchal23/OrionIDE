/**
 * Orion IDE — API Gateway Notification Routes
 *
 * Proxies /api/notifications/* → notification-service:3006
 * Handles SSE stream for real-time frontend notifications.
 * Forwards X-User-Id, X-User-Email, X-Request-Id headers.
 */

const { createProxyMiddleware } = require('http-proxy-middleware');

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006';

const notificationsProxy = createProxyMiddleware({
  target: NOTIFICATION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/': '/notifications/', // Express strips /api/notifications
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
    proxyRes: (proxyRes, req, res) => {
      // SSE streaming support — the primary use of notification-service
      const contentType = proxyRes.headers['content-type'] || '';
      if (contentType.includes('text/event-stream')) {
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
      }
    },
    error: (err, req, res) => {
      if (res && res.status) {
        res.status(502).json({
          error: {
            code: 'GATEWAY_UPSTREAM_ERROR',
            message: 'Notification service is unreachable',
            details: process.env.NODE_ENV === 'development' ? err.message : null,
          },
        });
      }
    },
  },
  // Long timeout for persistent SSE connections (24 hours)
  timeout: 86400000,
  proxyTimeout: 86400000,
});

const mountNotificationRoutes = (app) => {
  app.use('/api/notifications', notificationsProxy);
};

module.exports = { mountNotificationRoutes };
