/**
 * Orion IDE — Billing proxy (/api/billing → auth-service /billing)
 */

const { createProxyMiddleware } = require('http-proxy-middleware');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

const billingProxy = createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/': '/billing/' },
  on: {
    proxyReq: (proxyReq, req) => {
      if (req.requestId) proxyReq.setHeader('X-Request-Id', req.requestId);
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.id || req.user.userId || '');
        proxyReq.setHeader('X-User-Email', req.user.email || '');
      }
      const secret = process.env.INTERNAL_SECRET || process.env.DRIVE_SERVICE_SECRET || '';
      if (secret) {
        proxyReq.setHeader('X-Internal-Secret', secret);
        proxyReq.setHeader('X-Orion-Service-Secret', secret);
      }
    },
  },
  proxyTimeout: 30000,
});

const mountBillingRoutes = (app) => {
  // Public catalog + Stripe webhook (webhook needs raw body — auth-service handles)
  app.use('/api/billing', billingProxy);
};

module.exports = { mountBillingRoutes, billingProxy };
