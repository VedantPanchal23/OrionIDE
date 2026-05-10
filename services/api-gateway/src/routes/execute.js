/**
 * Orion IDE — API Gateway Execution Routes
 *
 * Proxies /api/execute/* → execution-service:3004
 * Handles SSE routes: disables buffering, sets correct headers, extends timeout.
 * Forwards X-User-Id, X-User-Email, X-Request-Id headers.
 */

const { createProxyMiddleware } = require('http-proxy-middleware');
const { executeLimiter } = require('../middleware/rateLimit');

const EXECUTION_SERVICE_URL = process.env.EXECUTION_SERVICE_URL || 'http://localhost:3004';

const executeProxy = createProxyMiddleware({
  target: EXECUTION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/': '/execute/', // Express strips /api/execute
  },
  // Disable response buffering for SSE streaming
  selfHandleResponse: false,
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
      // If this is an SSE stream response, set appropriate headers
      const contentType = proxyRes.headers['content-type'] || '';
      if (contentType.includes('text/event-stream')) {
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      }
    },
    error: (err, req, res) => {
      if (res && res.status) {
        res.status(502).json({
          error: {
            code: 'GATEWAY_UPSTREAM_ERROR',
            message: 'Execution service is unreachable',
            details: process.env.NODE_ENV === 'development' ? err.message : null,
          },
        });
      }
    },
  },
  // Extended timeout for long-running executions (2 minutes)
  timeout: 120000,
  proxyTimeout: 120000,
});

const mountExecuteRoutes = (app) => {
  app.use('/api/execute', executeLimiter, executeProxy);
};

module.exports = { mountExecuteRoutes };
