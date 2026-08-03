/**
 * Orion IDE — Auth Service Redis Client
 *
 * Shared Redis connection for the auth-service.
 * Used for refresh tokens, Google OAuth secrets, and one-time auth codes.
 *
 * Fail-fast on connect errors so request handlers can degrade cleanly
 * instead of hanging on reconnect storms.
 */

const { createClient } = require('redis');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('auth-service');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CONNECT_TIMEOUT_MS = Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 2000;

let redisClient = null;
let connectPromise = null;

/**
 * Get or create the Redis client.
 * Lazy initialization — only connects on first use.
 * Concurrent callers share a single in-flight connect attempt.
 * @returns {Promise<import('redis').RedisClientType>}
 */
const getRedisClient = async () => {
  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    const client = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: CONNECT_TIMEOUT_MS,
        reconnectStrategy: (retries) => {
          // Fail fast — callers handle absence; avoid multi-second hangs in request path
          if (retries >= 2) {
            logger.error('Redis max reconnect attempts reached');
            return false;
          }
          return Math.min(100 * (retries + 1), 300);
        },
      },
    });

    client.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });

    client.on('connect', () => {
      logger.info('Redis connected', { url: REDIS_URL });
    });

    client.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    client.on('end', () => {
      if (redisClient === client) {
        redisClient = null;
      }
    });

    try {
      await client.connect();
      redisClient = client;
      return client;
    } catch (err) {
      try {
        await client.disconnect();
      } catch {
        // ignore cleanup errors
      }
      redisClient = null;
      throw err;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
};

/**
 * Close the Redis connection gracefully.
 */
const closeRedisClient = async () => {
  connectPromise = null;
  if (redisClient?.isOpen) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
  redisClient = null;
};

module.exports = { getRedisClient, closeRedisClient };
