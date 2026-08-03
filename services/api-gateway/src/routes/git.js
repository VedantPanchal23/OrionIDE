/**
 * Orion IDE — Git Proxy
 * Proxies /api/git/* → terminal-service:3007/git/*
 */

const { createProxyMiddleware } = require('http-proxy-middleware');

const TERMINAL_SERVICE_URL = process.env.TERMINAL_SERVICE_URL || 'http://terminal-service:3007';

const gitProxy = createProxyMiddleware({
  target: TERMINAL_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/': '/git/', // Express strips /api/git
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
      const secret = process.env.INTERNAL_SECRET || process.env.DRIVE_SERVICE_SECRET || '';
      if (secret) {
        proxyReq.setHeader('X-Internal-Secret', secret);
        proxyReq.setHeader('X-Orion-Service-Secret', secret);
      }
      // Forward project context if client sent it
      if (req.headers['x-project-id']) {
        proxyReq.setHeader('X-Project-Id', req.headers['x-project-id']);
      }
    },
    proxyRes: (proxyRes, req, res) => {
      if (req.requestId) {
        proxyRes.headers['x-request-id'] = req.requestId;
      }
    },
  },
  proxyTimeout: 60000,
});

const mountGitRoutes = (app) => {
  app.use('/api/git', gitProxy);
};

module.exports = { mountGitRoutes, gitProxy };
