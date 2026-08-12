/**
 * Orion IDE — LSP Service
 * WebSocket JSON-RPC bridge to stdio language servers.
 *
 * WS: /lsp/ws?language=python&projectId=...&token=...
 * Auth: X-User-Id header (from gateway) or ?userId=
 */

require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { WebSocketServer } = require('ws');
const { URL } = require('url');
const { LspSession } = require('./sessionManager');
const { listSupportedLanguages } = require('./servers');
const { WORKSPACE_ROOT } = require('./workspace');

const app = express();
const PORT = Number(process.env.PORT || 3008);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'lsp-service',
    workspaceRoot: WORKSPACE_ROOT,
    languages: listSupportedLanguages(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/lsp/languages', (_req, res) => {
  res.json({ data: { languages: listSupportedLanguages() } });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  try {
    const url = new URL(req.url || '', 'http://localhost');
    if (!url.pathname.startsWith('/lsp/ws')) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, url);
    });
  } catch {
    socket.destroy();
  }
});

wss.on('connection', async (ws, req, url) => {
  const userId = req.headers['x-user-id']
    || url.searchParams.get('userId')
    || '';
  const projectId = url.searchParams.get('projectId') || '';
  const language = url.searchParams.get('language') || 'plaintext';

  if (!userId || !projectId) {
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: '$/orion/serverStatus',
      params: { status: 'error', message: 'userId and projectId are required' },
    }));
    ws.close();
    return;
  }

  const session = new LspSession({ ws, userId, projectId, language });
  const ok = await session.start();

  ws.on('message', (data) => {
    session.handleClientMessage(data.toString());
  });

  ws.on('close', () => session.dispose());
  ws.on('error', () => session.dispose());

  if (!ok) {
    // Keep socket open briefly so status events arrive; client may still use catalogs.
  }
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[lsp-service] listening on :${PORT} · workspace ${WORKSPACE_ROOT}`);
  });
}

module.exports = { app, server };
