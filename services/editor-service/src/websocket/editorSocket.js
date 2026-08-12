/**
 * Orion IDE — Editor WebSocket Server
 *
 * JWT-gated real-time rooms for presence, cursors, and content relay.
 * Not a CRDT — clients relay ops; last-write-wins for content updates.
 */

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { createLogger } = require('../../../../shared/utils/logger');
const { publishEvent } = require('../../../../shared/utils/notify');
const { EVENT_TYPES } = require('../../../../shared/constants/events');
const { bindYjsSocket } = require('./yjsRooms');
const { flags } = require('../../../../shared/utils/featureFlags');

const logger = createLogger('editor-service');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV !== 'test') {
  throw new Error('JWT_SECRET is required for editor-service WebSocket auth');
}
const RESOLVED_JWT_SECRET = JWT_SECRET || 'test-only-jwt-secret';

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const rooms = new Map();

const extractToken = (req, url) => {
  const q = url.searchParams.get('token');
  if (q) return q;

  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);

  const proto = req.headers['sec-websocket-protocol'];
  if (typeof proto === 'string' && proto.includes('access_token.')) {
    const part = proto.split(',').map((s) => s.trim()).find((s) => s.startsWith('access_token.'));
    if (part) return part.slice('access_token.'.length);
  }

  return null;
};

const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, RESOLVED_JWT_SECRET);
    if (decoded.type && decoded.type !== 'access') return null;
    if (!decoded.userId && !decoded.id && !decoded.sub) return null;
    return decoded;
  } catch {
    return null;
  }
};

const roomMembers = (roomId) => {
  const set = rooms.get(roomId);
  if (!set) return [];
  return [...set]
    .filter((c) => c.readyState === 1)
    .map((c) => ({ userId: c.userId, name: c.userName || null }));
};

const leaveRoom = (ws) => {
  if (!ws.roomId) return;
  const set = rooms.get(ws.roomId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(ws.roomId);
    else {
      broadcast(ws.roomId, {
        type: 'presence',
        roomId: ws.roomId,
        users: roomMembers(ws.roomId),
        left: ws.userId,
        timestamp: Date.now(),
      }, ws);
    }
  }
  ws.roomId = null;
};

const broadcast = (roomId, message, except = null) => {
  const set = rooms.get(roomId);
  if (!set) return;
  const payload = JSON.stringify(message);
  for (const client of set) {
    if (client === except) continue;
    if (client.readyState === 1) client.send(payload);
  }
};

const setupWebSocket = (server) => {
  const wss = new WebSocketServer({
    server,
    path: '/ws/editor',
    verifyClient: (info, done) => {
      try {
        const url = new URL(info.req.url, `http://${info.req.headers.host}`);
        const token = extractToken(info.req, url);
        if (!token) {
          done(false, 401, 'Unauthorized');
          return;
        }
        const decoded = verifyToken(token);
        if (!decoded) {
          done(false, 401, 'Invalid token');
          return;
        }
        info.req.editorUser = {
          userId: decoded.userId || decoded.id || decoded.sub,
          email: decoded.email,
          name: decoded.name,
          jti: decoded.jti,
        };
        info.req.editorRoomHint = url.searchParams.get('roomId') || url.searchParams.get('projectId');
        info.req.yjsMode = url.searchParams.get('yjs') === '1'
          || url.searchParams.get('protocol') === 'yjs';
        done(true);
      } catch {
        done(false, 401, 'Unauthorized');
      }
    },
  });

  wss.on('connection', (ws, req) => {
    const userId = req.editorUser?.userId;
    if (!userId) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    ws.userId = userId;
    ws.userName = req.editorUser?.name || null;
    ws.isAlive = true;
    ws.roomId = null;

    logger.info('WebSocket connected', { userId });
    publishEvent({
      type: EVENT_TYPES.EDITOR_SESSION_OPENED,
      userId,
      payload: {},
    }).catch(() => {});

    // Optional auto-join via query ?roomId=
    if (req.editorRoomHint) {
      if (req.yjsMode) {
        if (!flags().yjsCollab) {
          ws.send(JSON.stringify({
            type: 'error',
            code: 'YJS_DISABLED',
            message: 'CRDT collab disabled (set ENABLE_YJS_COLLAB=true when ready)',
          }));
          ws.close(1008, 'Yjs disabled');
          return;
        }
        bindYjsSocket(ws, String(req.editorRoomHint));
        // Do not send JSON after bind — clients speak binary y-protocols only
      } else {
        joinRoom(ws, String(req.editorRoomHint));
      }
    }

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      // Yjs sockets handle binary in bindYjsSocket
      if (ws.isYjs) return;

      let message;
      try {
        message = JSON.parse(data.toString());
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        return;
      }

      switch (message.type) {
        case 'join-yjs': {
          if (!flags().yjsCollab) {
            ws.send(JSON.stringify({
              type: 'error',
              code: 'YJS_DISABLED',
              message: 'CRDT collab disabled (set ENABLE_YJS_COLLAB=true when ready)',
            }));
            return;
          }
          const roomId = message.roomId || message.projectId;
          if (!roomId) {
            ws.send(JSON.stringify({ type: 'error', message: 'roomId required' }));
            return;
          }
          leaveRoom(ws);
          bindYjsSocket(ws, String(roomId));
          break;
        }
        case 'join': {
          const roomId = message.roomId || message.projectId;
          if (!roomId) {
            ws.send(JSON.stringify({ type: 'error', message: 'roomId required' }));
            return;
          }
          joinRoom(ws, String(roomId));
          break;
        }
        case 'leave':
          leaveRoom(ws);
          ws.send(JSON.stringify({ type: 'left', timestamp: Date.now() }));
          break;
        case 'cursor':
        case 'selection':
        case 'op':
        case 'content':
        case 'tab':
          if (!ws.roomId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Join a room first' }));
            return;
          }
          broadcast(ws.roomId, {
            ...message,
            userId: ws.userId,
            name: ws.userName,
            roomId: ws.roomId,
            timestamp: Date.now(),
          }, ws);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
        default:
          // Acknowledge unknown messages to the sender only
          ws.send(JSON.stringify({ type: 'ack', data: message, timestamp: Date.now() }));
      }
    });

    ws.on('close', () => {
      leaveRoom(ws);
      logger.info('WebSocket disconnected', { userId });
      publishEvent({
        type: EVENT_TYPES.EDITOR_SESSION_CLOSED,
        userId,
        payload: {},
      }).catch(() => {});
    });

    // Never send JSON on Yjs sockets — clients speak binary y-protocols only
    if (!ws.isYjs) {
      ws.send(JSON.stringify({ type: 'connected', userId, timestamp: Date.now() }));
    }
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.isYjs) {
        // Binary protocol: rely on WS-level ping only, keep isAlive true
        if (!client.isAlive) return client.terminate();
        client.isAlive = false;
        try { client.ping(); } catch { /* ignore */ }
        return;
      }
      if (!client.isAlive) return client.terminate();
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  logger.info('WebSocket server started', { path: '/ws/editor' });
  return wss;
};

function joinRoom(ws, roomId) {
  if (ws.roomId === roomId) return;
  leaveRoom(ws);
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId).add(ws);
  ws.roomId = roomId;

  const users = roomMembers(roomId);
  ws.send(JSON.stringify({
    type: 'joined',
    roomId,
    users,
    timestamp: Date.now(),
  }));
  broadcast(roomId, {
    type: 'presence',
    roomId,
    users,
    joined: ws.userId,
    timestamp: Date.now(),
  }, ws);

  logger.info('Joined editor room', { userId: ws.userId, roomId, size: users.length });
}

module.exports = { setupWebSocket, verifyToken, extractToken, rooms };
