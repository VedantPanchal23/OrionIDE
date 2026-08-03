/**
 * Orion IDE — API Gateway Terminal Routes
 *
 * HTTP: /api/terminal/* → terminal-service /terminal/*
 * WS:   handled via raw http-proxy in app.js (HPM upgrade is unreliable here)
 */

const { createProxyMiddleware } = require('http-proxy-middleware');
const httpProxy = require('http-proxy');

const TERMINAL_SERVICE_URL = process.env.TERMINAL_SERVICE_URL || 'http://localhost:3007';

const terminalProxy = createProxyMiddleware({
  target: TERMINAL_SERVICE_URL,
  changeOrigin: true,
  ws: false, // WS is handled explicitly with http-proxy in app.js
  pathRewrite: {
    // Express mounts at /api/terminal → /sessions becomes /terminal/sessions
    '^/': '/terminal/',
  },
  timeout: 0,
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
      const secret = process.env.INTERNAL_SECRET || process.env.DRIVE_SERVICE_SECRET;
      if (secret) {
        proxyReq.setHeader('X-Internal-Secret', secret);
        proxyReq.setHeader('X-Orion-Service-Secret', secret);
      }
    },
    error: (err, req, res) => {
      if (res && typeof res.status === 'function') {
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

/** Dedicated WS proxy — avoids http-proxy-middleware pathRewrite/upgrade bugs */
const terminalWsProxy = httpProxy.createProxyServer({
  target: TERMINAL_SERVICE_URL,
  ws: true,
  changeOrigin: true,
  xfwd: true,
});

terminalWsProxy.on('error', (err, _req, socket) => {
  // eslint-disable-next-line no-console
  console.error('[api-gateway] terminal WS proxy error:', err.message);
  if (socket && !socket.destroyed) {
    try {
      socket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
    } catch { /* ignore */ }
    try { socket.destroy(); } catch { /* ignore */ }
  }
});

/**
 * Forward a browser upgrade to terminal-service /terminal/ws/terminal
 * @param {import('http').IncomingMessage} req
 * @param {import('stream').Duplex} socket
 * @param {Buffer} head
 * @param {URL} upgradeUrl
 */
function upgradeTerminalWebSocket(req, socket, head, upgradeUrl) {
  const terminalId = upgradeUrl.searchParams.get('terminalId');
  const connectToken =
    upgradeUrl.searchParams.get('connectToken') || upgradeUrl.searchParams.get('token');
  if (!terminalId || !connectToken) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const params = new URLSearchParams({
    terminalId,
    token: connectToken,
  });
  req.url = `/terminal/ws/terminal?${params.toString()}`;
  terminalWsProxy.ws(req, socket, head);
}

const mountTerminalRoutes = (app) => {
  app.use('/api/terminal', terminalProxy);
};

module.exports = {
  mountTerminalRoutes,
  terminalProxy,
  upgradeTerminalWebSocket,
};
