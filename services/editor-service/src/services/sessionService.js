/**
 * Orion IDE — Session Service
 *
 * Manages per-user editor sessions in Redis.
 * Tracks open files, active file, and dirty state.
 *
 * Redis key: editor:session:{userId}
 * Value: JSON { openFiles: [...], activeFileId }
 * TTL: 24 hours (refreshed on every activity)
 */

const { getRedisClient } = require('./redisClient');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('editor-service');

const SESSION_PREFIX = 'editor:session:';
const SESSION_TTL = 24 * 60 * 60; // 24 hours

/**
 * Get the session key for a user.
 */
const sessionKey = (userId) => `${SESSION_PREFIX}${userId}`;

/**
 * Get or create a session for a user.
 * @param {string} userId
 * @returns {Promise<{ openFiles: Array, activeFileId: string|null }>}
 */
const getSession = async (userId) => {
  const redis = await getRedisClient();
  const data = await redis.get(sessionKey(userId));

  if (data) {
    // Refresh TTL on every access
    await redis.expire(sessionKey(userId), SESSION_TTL);
    return JSON.parse(data);
  }

  // Return empty default session
  return { openFiles: [], activeFileId: null };
};

/**
 * Save session to Redis.
 */
const saveSession = async (userId, session) => {
  const redis = await getRedisClient();
  await redis.set(sessionKey(userId), JSON.stringify(session), { EX: SESSION_TTL });
};

/**
 * Open a file in the user's session.
 * Adds to openFiles if not already there, sets as active.
 *
 * @param {string} userId
 * @param {string} fileId
 * @param {string} fileName
 * @param {string} language
 * @returns {Promise<object>} updated session state
 */
const openFile = async (userId, fileId, fileName, language) => {
  const session = await getSession(userId);

  // Check if file already open
  const existingIdx = session.openFiles.findIndex((f) => f.fileId === fileId);

  if (existingIdx === -1) {
    session.openFiles.push({
      fileId,
      fileName,
      language: language || 'plaintext',
      isDirty: false,
      openedAt: new Date().toISOString(),
    });
  }

  session.activeFileId = fileId;
  await saveSession(userId, session);

  logger.debug('File opened in session', { userId, fileId, fileName });
  return session;
};

/**
 * Close a file in the user's session.
 *
 * @param {string} userId
 * @param {string} fileId
 * @returns {Promise<object>} updated session state
 */
const closeFile = async (userId, fileId) => {
  const session = await getSession(userId);

  session.openFiles = session.openFiles.filter((f) => f.fileId !== fileId);

  // If the closed file was active, switch to last open file
  if (session.activeFileId === fileId) {
    session.activeFileId = session.openFiles.length > 0
      ? session.openFiles[session.openFiles.length - 1].fileId
      : null;
  }

  await saveSession(userId, session);

  logger.debug('File closed in session', { userId, fileId });
  return session;
};

/**
 * Set the active file in the session.
 *
 * @param {string} userId
 * @param {string} fileId
 * @returns {Promise<object>} updated session state
 */
const setActiveFile = async (userId, fileId) => {
  const session = await getSession(userId);
  session.activeFileId = fileId;
  await saveSession(userId, session);

  return session;
};

/**
 * Mark a file as dirty (unsaved changes) or clean.
 *
 * @param {string} userId
 * @param {string} fileId
 * @param {boolean} isDirty
 * @returns {Promise<object>} updated session state
 */
const markDirty = async (userId, fileId, isDirty) => {
  const session = await getSession(userId);

  const file = session.openFiles.find((f) => f.fileId === fileId);
  if (file) {
    file.isDirty = isDirty;
    await saveSession(userId, session);
  }

  return session;
};

module.exports = {
  getSession,
  openFile,
  closeFile,
  setActiveFile,
  markDirty,
  SESSION_PREFIX,
};
