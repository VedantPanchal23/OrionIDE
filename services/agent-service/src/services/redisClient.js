/**
 * Orion IDE — Agent Service Redis Client
 */
const { createClient } = require('redis');
const { createLogger } = require('../../../../shared/utils/logger');
const logger = createLogger('agent-service');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let client = null;

const getRedisClient = async () => {
  if (client && client.isOpen) return client;
  client = createClient({ url: REDIS_URL, socket: { reconnectStrategy: (r) => Math.min(r * 100, 5000) } });
  client.on('error', (err) => logger.error('Redis error', { error: err.message }));
  await client.connect();
  return client;
};

const closeRedisClient = async () => { if (client?.isOpen) await client.quit(); };
module.exports = { getRedisClient, closeRedisClient };
