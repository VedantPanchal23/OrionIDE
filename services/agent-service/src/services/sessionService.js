/**
 * Orion IDE — Agent Session Service
 *
 * Redis-backed pipeline session state management.
 */

const { v4: uuidv4 } = require('uuid');
const { getRedisClient } = require('./redisClient');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');
const SESSION_PREFIX = 'agent:session:';
const SESSION_TTL = 86400; // 24 hours

/**
 * Create a new pipeline session.
 */
const createSession = async (userId, goal) => {
  const sessionId = uuidv4();
  const session = {
    sessionId,
    userId,
    goal,
    projectName: null,
    currentStep: 1,
    status: 'running',
    planner: { output: null, approved: false, rejections: [] },
    designer: { output: null, approved: false, rejections: [] },
    implementer: { files: [], currentIndex: 0, totalFiles: 0 },
    reviewer: { reviews: [] },
    fileAgent: { written: [], pending: [], projectFolderId: null },
    runAgent: { command: null, result: null },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const redis = await getRedisClient();
  await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(session), { EX: SESSION_TTL });

  logger.info('Pipeline session created', { sessionId, userId });
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

/**
 * Update a session field using dot-notation path.
 * e.g. updateSession(id, 'planner.output', { ... })
 */
const updateSession = async (sessionId, path, value) => {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');

  // Navigate dot-notation path and set value
  const keys = path.split('.');
  let current = session;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  session.updatedAt = new Date().toISOString();

  const redis = await getRedisClient();
  await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(session), { EX: SESSION_TTL });

  return session;
};

/**
 * Update multiple fields at once.
 */
const updateSessionMulti = async (sessionId, updates) => {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');

  for (const [path, value] of Object.entries(updates)) {
    const keys = path.split('.');
    let current = session;
    for (let i = 0; i < keys.length - 1; i++) {
      if (current[keys[i]] === undefined) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  session.updatedAt = new Date().toISOString();

  const redis = await getRedisClient();
  await redis.set(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(session), { EX: SESSION_TTL });

  return session;
};

module.exports = { createSession, getSession, updateSession, updateSessionMulti };
