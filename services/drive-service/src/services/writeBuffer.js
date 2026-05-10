/**
 * Orion IDE — Write Buffer Service
 *
 * Redis-backed write buffer that batches file writes to Google Drive.
 *
 * How it works:
 *   1. User edits file → PUT /drive/files/:id → content stored in Redis (not Drive)
 *   2. Every 60 seconds, a flush job writes all buffered content to Drive
 *   3. User presses Ctrl+S → PUT /drive/files/:id/flush → immediate Drive write
 *
 * Redis key pattern:
 *   drive:buffer:{userId}:{fileId} → file content string, TTL 120s
 *
 * This reduces Drive API calls from potentially hundreds per minute
 * (on every keystroke) to at most 1 per file per 60 seconds.
 */

const { getRedisClient } = require('./redisClient');
const { createDriveClient } = require('./driveClient');
const { updateFile } = require('./fileService');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('drive-service');

const BUFFER_PREFIX = 'drive:buffer:';
const BUFFER_TTL = 120; // 2 minutes — safety net in case flush fails
const FLUSH_INTERVAL = 60 * 1000; // 60 seconds
const RETRY_DELAY = 10 * 1000; // 10 seconds

// Store google access tokens temporarily for flush operations
const TOKEN_PREFIX = 'drive:token:';
const TOKEN_TTL = 300; // 5 minutes

/**
 * Add file content to the write buffer.
 * Content will be written to Drive on the next flush cycle (every 60s).
 *
 * @param {string} userId
 * @param {string} fileId
 * @param {string} content — new file content
 * @param {string} googleAccessToken — needed later for the actual Drive write
 */
const addToBuffer = async (userId, fileId, content, googleAccessToken) => {
  const redis = await getRedisClient();
  const bufferKey = `${BUFFER_PREFIX}${userId}:${fileId}`;
  const tokenKey = `${TOKEN_PREFIX}${userId}`;

  // Store content
  await redis.set(bufferKey, content, { EX: BUFFER_TTL });

  // Store/refresh the user's access token (needed for flushing)
  await redis.set(tokenKey, googleAccessToken, { EX: TOKEN_TTL });

  logger.debug('Content buffered', { userId, fileId });
};

/**
 * Flush all buffered files for a specific user to Google Drive.
 *
 * @param {string} userId
 * @returns {Promise<{ flushed: number, errors: number }>}
 */
const flushBuffer = async (userId) => {
  const redis = await getRedisClient();
  const pattern = `${BUFFER_PREFIX}${userId}:*`;

  // Get the user's access token
  const tokenKey = `${TOKEN_PREFIX}${userId}`;
  const googleAccessToken = await redis.get(tokenKey);

  if (!googleAccessToken) {
    logger.warn('No access token for flush — skipping', { userId });
    return { flushed: 0, errors: 0 };
  }

  const driveClient = createDriveClient(googleAccessToken);

  // Scan for all buffered files for this user
  let cursor = 0;
  let flushed = 0;
  let errors = 0;

  do {
    const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
    cursor = result.cursor;

    for (const key of result.keys) {
      const content = await redis.get(key);
      if (content === null) continue;

      // Extract fileId from key: drive:buffer:{userId}:{fileId}
      const fileId = key.split(':').pop();

      try {
        await updateFile(driveClient, fileId, content);
        await redis.del(key);
        flushed++;
        logger.debug('Buffer flushed to Drive', { userId, fileId });
      } catch (err) {
        errors++;
        logger.error('Buffer flush failed', { userId, fileId, error: err.message });

        // Retry once after delay
        setTimeout(async () => {
          try {
            const retryContent = await redis.get(key);
            if (retryContent !== null) {
              await updateFile(driveClient, fileId, retryContent);
              await redis.del(key);
              logger.info('Buffer flush retry succeeded', { userId, fileId });
            }
          } catch (retryErr) {
            logger.error('Buffer flush retry failed — clearing buffer', {
              userId,
              fileId,
              error: retryErr.message,
            });
            // Clear the buffer to prevent stale data
            await redis.del(key).catch(() => {});
          }
        }, RETRY_DELAY);
      }
    }
  } while (cursor !== 0);

  if (flushed > 0) {
    logger.info('Buffer flush completed', { userId, flushed, errors });
  }

  return { flushed, errors };
};

/**
 * Flush a single file immediately to Drive (bypasses the buffer cycle).
 * Used for Ctrl+S / manual save.
 *
 * @param {string} userId
 * @param {string} fileId
 * @param {string} content — file content to write
 * @param {string} googleAccessToken — user's Google access token
 * @returns {Promise<{ id: string, modifiedTime: string }>}
 */
const flushImmediate = async (userId, fileId, content, googleAccessToken) => {
  const driveClient = createDriveClient(googleAccessToken);
  const result = await updateFile(driveClient, fileId, content);

  // Clear the buffer entry if it exists
  try {
    const redis = await getRedisClient();
    const bufferKey = `${BUFFER_PREFIX}${userId}:${fileId}`;
    await redis.del(bufferKey);
  } catch (err) {
    // Non-fatal — the buffer will expire via TTL anyway
    logger.warn('Failed to clear buffer after immediate flush', { error: err.message });
  }

  logger.info('Immediate flush to Drive', { userId, fileId });
  return result;
};

/**
 * Flush ALL pending buffers for ALL users.
 * Called by the interval timer every 60 seconds.
 */
const flushAllBuffers = async () => {
  try {
    const redis = await getRedisClient();
    const pattern = `${BUFFER_PREFIX}*`;

    // Collect unique userIds from buffer keys
    const userIds = new Set();
    let cursor = 0;

    do {
      const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;

      for (const key of result.keys) {
        // Key format: drive:buffer:{userId}:{fileId}
        const parts = key.replace(BUFFER_PREFIX, '').split(':');
        if (parts.length >= 1) {
          userIds.add(parts[0]);
        }
      }
    } while (cursor !== 0);

    // Flush each user's buffer
    for (const userId of userIds) {
      await flushBuffer(userId);
    }
  } catch (err) {
    logger.error('Global buffer flush failed', { error: err.message });
  }
};

// ── Auto-flush interval ──────────────────────────────────────────────────
let flushIntervalId = null;

/**
 * Start the automatic flush interval (every 60 seconds).
 */
const startAutoFlush = () => {
  if (flushIntervalId) return;

  flushIntervalId = setInterval(flushAllBuffers, FLUSH_INTERVAL);
  logger.info('Write buffer auto-flush started', { intervalMs: FLUSH_INTERVAL });
};

/**
 * Stop the automatic flush interval.
 */
const stopAutoFlush = () => {
  if (flushIntervalId) {
    clearInterval(flushIntervalId);
    flushIntervalId = null;
    logger.info('Write buffer auto-flush stopped');
  }
};

module.exports = {
  addToBuffer,
  flushBuffer,
  flushImmediate,
  flushAllBuffers,
  startAutoFlush,
  stopAutoFlush,
  // Exported for testing
  BUFFER_PREFIX,
  BUFFER_TTL,
};
