/**
 * Orion IDE — Drive Service Redis Client
 *
 * Shared Redis connection for drive-service.
 * Used for:
 *   - Root folder ID caching (drive:{userId}:rootFolderId)
 *   - Write buffer (drive:buffer:{userId}:{fileId})
 */

const { createClient } = require('redis');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('drive-service');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient = null;

const getRedisClient = async () => {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  redisClient = createClient({
    url: REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) return new Error('Redis max reconnect attempts');
        return Math.min(retries * 100, 5000);
      },
    },
  });

  redisClient.on('error', (err) => logger.error('Redis error', { error: err.message }));
  redisClient.on('connect', () => logger.info('Redis connected'));

  await redisClient.connect();
  return redisClient;
};

const closeRedisClient = async () => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
  }
};

module.exports = { getRedisClient, closeRedisClient };
