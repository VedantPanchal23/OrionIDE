/**
 * Orion IDE — API Gateway Agent Routes
 *
 * Proxies /api/agents/* → agent-service:3005
 * Handles SSE routes for real-time agent pipeline streaming.
 * Forwards X-User-Id, X-User-Email, X-Request-Id headers.
 */

const { createProxyMiddleware } = require('http-proxy-middleware');
const { agentLimiter } = require('../middleware/rateLimit');

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3005';

const agentsProxy = createProxyMiddleware({
  target: AGENT_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/': '/agents/', // Express strips /api/agents
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
      // SSE streaming support for agent pipeline output
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
            message: 'Agent service is unreachable',
            details: process.env.NODE_ENV === 'development' ? err.message : null,
          },
        });
      }
    },
  },
  // Extended timeout for LLM inference (3 minutes)
  timeout: 180000,
  proxyTimeout: 180000,
});

const mountAgentRoutes = (app) => {
  app.use('/api/agents', agentLimiter, agentsProxy);
};

module.exports = { mountAgentRoutes };
