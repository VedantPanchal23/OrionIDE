/**
 * Orion IDE — API Gateway Terminal Routes
 *
 * Proxies /api/terminal/* → terminal-service:3007
 * Supports WebSocket upgrade for interactive PTY sessions.
 * Forwards X-User-Id, X-User-Email, X-Request-Id headers.
 */

const { createProxyMiddleware } = require('http-proxy-middleware');

const TERMINAL_SERVICE_URL = process.env.TERMINAL_SERVICE_URL || 'http://localhost:3007';

const terminalProxy = createProxyMiddleware({
  target: TERMINAL_SERVICE_URL,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying for PTY connections
  pathRewrite: {
    '^/': '/terminal/', // Express strips /api/terminal, so /sessions → /terminal/sessions
  },
  timeout: 0, // No timeout for long-lived terminal connections
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
    proxyReqWs: (proxyReq, req) => {
      if (req.requestId) {
        proxyReq.setHeader('X-Request-Id', req.requestId);
      }
    },
    error: (err, req, res) => {
      if (res && res.status) {
        res.status(502).json({
          error: {
            code: 'GATEWAY_UPSTREAM_ERROR',
            message: 'Terminal service is unreachable',
            details: process.env.NODE_ENV === 'development' ? err.message : null,
          },
        });
      }
    },
  },
});

const mountTerminalRoutes = (app) => {
  app.use('/api/terminal', terminalProxy);
};

module.exports = { mountTerminalRoutes };
