/**
 * Orion IDE — Auth Service Redis Client
 *
 * Shared Redis connection for the auth-service.
 * Used by tokenService for refresh token storage/revocation.
 *
 * Key pattern: auth:refresh:{userId}:{tokenHash}
 */

const { createClient } = require('redis');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('auth-service');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient = null;

/**
 * Get or create the Redis client.
 * Lazy initialization — only connects on first use.
 * @returns {Promise<import('redis').RedisClientType>}
 */
const getRedisClient = async () => {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  redisClient = createClient({
    url: REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis max reconnect attempts reached');
          return new Error('Redis max reconnect attempts');
        }
        return Math.min(retries * 100, 5000);
      },
    },
  });

  redisClient.on('error', (err) => {
    logger.error('Redis client error', { error: err.message });
  });

  redisClient.on('connect', () => {
    logger.info('Redis connected', { url: REDIS_URL });
  });

  redisClient.on('reconnecting', () => {
    logger.warn('Redis reconnecting...');
  });

  await redisClient.connect();
  return redisClient;
};

/**
 * Close the Redis connection gracefully.
 */
const closeRedisClient = async () => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
};

module.exports = { getRedisClient, closeRedisClient };
