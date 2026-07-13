/**
 * Orion IDE — API Gateway Editor Routes
 *
 * Proxies /api/editor/* → editor-service:3003
 * Supports WebSocket upgrade for real-time editor events.
 * Forwards X-User-Id, X-User-Email, X-Request-Id headers.
 */

const { createProxyMiddleware } = require('http-proxy-middleware');

const EDITOR_SERVICE_URL = process.env.EDITOR_SERVICE_URL || 'http://localhost:3003';

const editorProxy = createProxyMiddleware({
  target: EDITOR_SERVICE_URL,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying for real-time editor events
  pathRewrite: {
    '^/': '/editor/', // Express strips /api/editor, so /session/state → /editor/session/state
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
    // Handle WebSocket upgrade: forward auth headers during upgrade
    proxyReqWs: (proxyReq, req) => {
      if (req.requestId) {
        proxyReq.setHeader('X-Request-Id', req.requestId);
      }
    },
    error: (err, req, res) => {
      // WebSocket errors don't have a res object — guard against it
      if (res && res.status) {
        res.status(502).json({
          error: {
            code: 'GATEWAY_UPSTREAM_ERROR',
            message: 'Editor service is unreachable',
            details: process.env.NODE_ENV === 'development' ? err.message : null,
          },
        });
      }
    },
  },
});

const mountEditorRoutes = (app) => {
  app.use('/api/editor', editorProxy);
};

module.exports = { mountEditorRoutes, editorProxy };
