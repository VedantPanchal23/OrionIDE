/**
 * Orion IDE — Terminal Service
 *
 * HTTP server (Express) + WebSocket server for interactive PTY terminals.
 *
 * REST endpoints:
 *   GET  /health                → service health + stats
 *   GET  /terminal/sessions     → list user's terminals
 *   POST /terminal/sessions     → create a new terminal
 *   DELETE /terminal/sessions/:id → destroy a terminal
 *
 * WebSocket:
 *   /ws/terminal?terminalId=<id>&token=<jwt>
 *
 *   Client → Server messages:
 *     { "type": "input", "data": "..." }       — stdin to PTY
 *     { "type": "resize", "cols": N, "rows": N } — resize PTY
 *
 *   Server → Client messages:
 *     { "type": "output", "data": "..." }       — stdout/stderr from PTY
 *     { "type": "exit", "code": N }             — PTY process exited
 *     { "type": "error", "message": "..." }     — error
 */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const ptyManager = require('./services/ptyManager');

const app = express();
const PORT = process.env.PORT || 3007;

// ── Middleware ───────────────────────────────────────────────────────────
app.use(helmet());

// CORS — trust gateway or use permissive in dev
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3010'];
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  // Extract user from gateway headers
  req.userId = req.headers['x-user-id'] || null;
  next();
});

// ── Health ────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const stats = ptyManager.getStats();
  res.json({
    status: 'ok',
    service: 'terminal-service',
    timestamp: new Date().toISOString(),
    ...stats,
  });
});

// ── REST: List user's terminals ──────────────────────────────────────────
app.get('/terminal/sessions', (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Missing X-User-Id header' } });
  }
  const sessions = ptyManager.listUserSessions(req.userId);
  res.json({ data: sessions });
});

// ── REST: Create a terminal ──────────────────────────────────────────────
app.post('/terminal/sessions', (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Missing X-User-Id header' } });
  }
  try {
    const { cols, rows, cwd } = req.body || {};
    const result = ptyManager.createSession(req.userId, { cols, rows, cwd });
    console.log(`[terminal] Created terminal ${result.terminalId} for user ${req.userId}`);
    res.status(201).json({ data: result });
  } catch (err) {
    const status = err.code === 'TERMINAL_LIMIT_EXCEEDED' ? 429 : 500;
    res.status(status).json({ error: { code: err.code || 'TERMINAL_ERROR', message: err.message } });
  }
});

// ── REST: Destroy a terminal ─────────────────────────────────────────────
app.delete('/terminal/sessions/:terminalId', (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Missing X-User-Id header' } });
  }
  const session = ptyManager.getSession(req.params.terminalId);
  if (!session) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Terminal not found' } });
  }
  if (session.userId !== req.userId) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your terminal' } });
  }
  ptyManager.destroySession(req.params.terminalId);
  console.log(`[terminal] Destroyed terminal ${req.params.terminalId}`);
  res.json({ data: { terminated: true } });
});

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` } });
});

// ── Error handler ─────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[terminal] Unhandled error:', err.message);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
});

// ── Create HTTP server ────────────────────────────────────────────────────
const server = http.createServer(app);

// ── WebSocket server ──────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/terminal/ws/terminal' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const terminalId = url.searchParams.get('terminalId');

  if (!terminalId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Missing terminalId query parameter' }));
    ws.close(1008, 'Missing terminalId');
    return;
  }

  const session = ptyManager.getSession(terminalId);
  if (!session) {
    ws.send(JSON.stringify({ type: 'error', message: 'Terminal session not found' }));
    ws.close(1008, 'Session not found');
    return;
  }

  console.log(`[terminal] WebSocket connected for terminal ${terminalId}`);

  // ── PTY → WebSocket (stdout) ────────────────────────────────────────
  const dataHandler = session.pty.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }));
    }
  });

  // ── PTY exit ────────────────────────────────────────────────────────
  const exitHandler = session.pty.onExit(({ exitCode, signal }) => {
    console.log(`[terminal] PTY exited: terminal=${terminalId} code=${exitCode} signal=${signal}`);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: exitCode, signal }));
      ws.close(1000, 'PTY exited');
    }
    ptyManager.destroySession(terminalId);
  });

  // ── WebSocket → PTY (stdin + control) ───────────────────────────────
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      // If it's not valid JSON, treat as raw input
      ptyManager.writeToSession(terminalId, raw.toString());
      return;
    }

    switch (msg.type) {
      case 'input':
        ptyManager.writeToSession(terminalId, msg.data || '');
        break;
      case 'resize':
        if (msg.cols && msg.rows) {
          ptyManager.resizeSession(terminalId, msg.cols, msg.rows);
        }
        break;
      default:
        break;
    }
  });

  // ── Cleanup on WebSocket close ──────────────────────────────────────
  ws.on('close', () => {
    console.log(`[terminal] WebSocket disconnected for terminal ${terminalId}`);
    dataHandler.dispose();
    exitHandler.dispose();
    // Don't destroy the session immediately — allow reconnect.
    // Idle cleanup will handle it after 30 minutes.
  });

  ws.on('error', (err) => {
    console.error(`[terminal] WebSocket error for ${terminalId}:`, err.message);
  });

  // Send a connected confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    terminalId,
    shell: session.shell,
    cols: session.cols,
    rows: session.rows,
  }));
});

// ── Periodic cleanup ──────────────────────────────────────────────────────
const cleanupInterval = setInterval(() => {
  ptyManager.cleanupIdleSessions();
}, 5 * 60 * 1000); // Every 5 minutes

// ── Start server ──────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`[terminal] Terminal Service started on port ${PORT}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────
const shutdown = () => {
  console.log('[terminal] Shutting down...');
  clearInterval(cleanupInterval);
  ptyManager.destroyAll();
  wss.close();
  server.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
