/**
 * Orion IDE — API Gateway LSP Routes
 * HTTP: /api/lsp/* → lsp-service /lsp/*
 * WS:   /api/lsp/ws → JWT required; trusted X-User-Id forwarded
 */

const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');
const httpProxy = require('http-proxy');

const LSP_SERVICE_URL = process.env.LSP_SERVICE_URL || 'http://localhost:3008';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const SERVICE_SECRET = process.env.INTERNAL_SECRET || process.env.DRIVE_SERVICE_SECRET || '';

const lspProxy = createProxyMiddleware({
  target: LSP_SERVICE_URL,
  changeOrigin: true,
  ws: false,
  pathRewrite: { '^/': '/lsp/' },
  timeout: 0,
  on: {
    proxyReq: (proxyReq, req) => {
      if (req.requestId) proxyReq.setHeader('X-Request-Id', req.requestId);
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.id || req.user.userId || '');
        proxyReq.setHeader('X-User-Email', req.user.email || '');
      }
      if (SERVICE_SECRET) {
        proxyReq.setHeader('X-Internal-Secret', SERVICE_SECRET);
        proxyReq.setHeader('X-Orion-Service-Secret', SERVICE_SECRET);
      }
    },
    error: (err, req, res) => {
      if (res && typeof res.status === 'function') {
        res.status(502).json({
          error: {
            code: 'GATEWAY_UPSTREAM_ERROR',
            message: 'LSP service is unreachable',
            details: process.env.NODE_ENV === 'development' ? err.message : null,
          },
        });
      }
    },
  },
});

const lspWsProxy = httpProxy.createProxyServer({
  target: LSP_SERVICE_URL,
  ws: true,
  changeOrigin: true,
  xfwd: true,
});

lspWsProxy.on('error', (err, _req, socket) => {
  // eslint-disable-next-line no-console
  console.error('[api-gateway] LSP WS proxy error:', err.message);
  if (socket && !socket.destroyed) {
    try { socket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n'); } catch { /* ignore */ }
    try { socket.destroy(); } catch { /* ignore */ }
  }
});

async function validateToken(token) {
  const headers = { Authorization: `Bearer ${token}` };
  if (SERVICE_SECRET) headers['X-Internal-Secret'] = SERVICE_SECRET;
  const response = await axios.get(`${AUTH_SERVICE_URL}/auth/validate`, {
    headers,
    timeout: 5000,
  });
  return response.data?.data || null;
}

/**
 * Forward a browser upgrade to lsp-service after JWT validation.
 * Replaces query userId with the authenticated user id.
 */
async function upgradeLspWebSocket(req, socket, head, upgradeUrl) {
  const token = upgradeUrl.searchParams.get('token')
    || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  let user;
  try {
    user = await validateToken(token);
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  if (!user) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const userId = user.id || user.userId || '';
  const params = new URLSearchParams(upgradeUrl.search);
  params.set('userId', userId);
  // Keep token out of upstream logs when possible
  params.delete('token');

  const nextPath = `${upgradeUrl.pathname.replace(/^\/api\/lsp/, '/lsp')}?${params.toString()}`;
  req.url = nextPath;
  req.headers['x-user-id'] = userId;
  if (user.email) req.headers['x-user-email'] = user.email;
  if (SERVICE_SECRET) {
    req.headers['x-internal-secret'] = SERVICE_SECRET;
    req.headers['x-orion-service-secret'] = SERVICE_SECRET;
  }

  lspWsProxy.ws(req, socket, head);
}

function mountLspRoutes(app) {
  app.use('/api/lsp', lspProxy);
}

module.exports = {
  mountLspRoutes,
  upgradeLspWebSocket,
  lspProxy,
};
