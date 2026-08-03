/**
 * Orion IDE — API Gateway Editor Routes
 *
 * Proxies /api/editor/* → editor-service:3003
 * Supports WebSocket upgrade for real-time editor events.
 * Forwards X-User-Id, X-User-Email, X-Request-Id headers.
 */

const { createProxyMiddleware } = require('http-proxy-middleware');
const { requireFeature } = require('../middleware/entitlements');
const { flags } = require('../../../../shared/utils/featureFlags');

const EDITOR_SERVICE_URL = process.env.EDITOR_SERVICE_URL || 'http://localhost:3003';

const editorProxy = createProxyMiddleware({
  target: EDITOR_SERVICE_URL,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying for real-time editor events
  pathRewrite: (path) => {
    // Keep /ws/* as-is (editor WebSocket listens on /ws/editor)
    if (path.startsWith('/ws/') || path === '/ws') return path;
    if (path.startsWith('/editor/') || path === '/editor') return path;
    return `/editor${path.startsWith('/') ? path : `/${path}`}`;
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
  app.use('/api/editor', (req, res, next) => {
    if (req.path.startsWith('/debug')) {
      if (!flags().debuggerApi) {
        return res.status(503).json({
          error: {
            code: 'DEBUGGER_DISABLED',
            message: 'Debugger API is disabled until sync/auth are production-ready (set ENABLE_DEBUGGER_API=true)',
            details: null,
          },
        });
      }
      return requireFeature('debugger')(req, res, next);
    }
    return next();
  }, editorProxy);
};

module.exports = { mountEditorRoutes, editorProxy };
