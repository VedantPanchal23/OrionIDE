/**
 * Orion IDE — Agent Session Service
 *
 * Redis-backed pipeline session state management.
 * Updates use a short-lived per-session lock so concurrent RMW cannot lose fields.
 */

const { v4: uuidv4 } = require('uuid');
const { getRedisClient } = require('./redisClient');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');
const SESSION_PREFIX = 'agent:session:';
const SESSION_TTL = 86400; // 24 hours
const LOCK_TTL_SECONDS = 5;
const LOCK_WAIT_MS = 8000;

/**
 * Create a new pipeline session.
 */
const createSession = async (userId, goal, options = {}) => {
  const sessionId = uuidv4();
  const llm = options.llm && typeof options.llm === 'object'
    ? {
      provider: options.llm.provider || null,
      model: options.llm.model || null,
      apiKey: options.llm.apiKey || null,
      baseUrl: options.llm.baseUrl || null,
    }
    : null;
  const session = {
    sessionId,
    userId,
    goal,
    googleAccessToken: options.googleAccessToken || null,
    llm,
    projectName: options.projectName || null,
    fileAgent: {
      written: [],
      pending: [],
      projectFolderId: options.projectFolderId || null,
    },
    currentStep: 1,
    status: 'running',
    planner: { output: null, approved: false, rejections: [] },
    designer: { output: null, approved: false, rejections: [] },
    implementer: { files: [], currentIndex: 0, totalFiles: 0 },
    reviewer: { reviews: [] },
    runAgent: { command: null, result: null },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const redis = await getRedisClient();
  await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(session), { EX: SESSION_TTL });

  logger.info('Pipeline session created', { sessionId, userId, byok: Boolean(llm?.apiKey) });
  return session;
};

/**
 * Get a session by ID.
 */
const getSession = async (sessionId) => {
  const redis = await getRedisClient();
  const data = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  return data ? JSON.parse(data) : null;
};

function applyDotPath(session, path, value) {
  const keys = path.split('.');
  let current = session;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined || current[keys[i]] === null) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

/**
 * Acquire a short Redis lock for a session, run fn, then release.
 */
async function withSessionLock(sessionId, fn) {
  const redis = await getRedisClient();
  const lockKey = `${SESSION_PREFIX}${sessionId}:lock`;
  const token = uuidv4();
  const deadline = Date.now() + LOCK_WAIT_MS;

  while (Date.now() < deadline) {
    const ok = await redis.set(lockKey, token, { NX: true, EX: LOCK_TTL_SECONDS });
    if (ok) {
      try {
        return await fn(redis);
      } finally {
        try {
          const cur = await redis.get(lockKey);
          if (cur === token) await redis.del(lockKey);
        } catch { /* ignore unlock errors */ }
      }
    }
    await new Promise((r) => setTimeout(r, 15 + Math.floor(Math.random() * 35)));
  }

  throw Object.assign(new Error('Could not acquire session lock'), { code: 'SESSION_LOCK_TIMEOUT' });
}

/**
 * Update a session field using dot-notation path.
 * e.g. updateSession(id, 'planner.output', { ... })
 */
const updateSession = async (sessionId, path, value) => withSessionLock(sessionId, async (redis) => {
  const key = `${SESSION_PREFIX}${sessionId}`;
  const data = await redis.get(key);
  if (!data) throw new Error('Session not found');

  const session = JSON.parse(data);
  applyDotPath(session, path, value);
  session.updatedAt = new Date().toISOString();

  await redis.set(key, JSON.stringify(session), { EX: SESSION_TTL });
  return session;
});

/**
 * Update multiple fields at once (single locked RMW).
 */
const updateSessionMulti = async (sessionId, updates) => withSessionLock(sessionId, async (redis) => {
  const key = `${SESSION_PREFIX}${sessionId}`;
  const data = await redis.get(key);
  if (!data) throw new Error('Session not found');

  const session = JSON.parse(data);
  for (const [path, value] of Object.entries(updates)) {
    applyDotPath(session, path, value);
  }
  session.updatedAt = new Date().toISOString();

  await redis.set(key, JSON.stringify(session), { EX: SESSION_TTL });
  return session;
});

module.exports = {
  createSession,
  getSession,
  updateSession,
  updateSessionMulti,
  /** Strip secrets before returning session JSON to clients */
  toPublicSession(session) {
    if (!session) return null;
    const { googleAccessToken, llm, ...rest } = session;
    return {
      ...rest,
      llm: llm
        ? {
          provider: llm.provider || null,
          model: llm.model || null,
          configured: Boolean(llm.apiKey),
        }
        : null,
    };
  },
};
