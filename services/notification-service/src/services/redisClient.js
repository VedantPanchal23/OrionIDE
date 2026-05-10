/**
 * Orion IDE — Notification Service Redis Client
 *
 * Two connections: one for commands, one for Pub/Sub subscriber.
 */

const { createClient } = require('redis');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('notification-service');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let commandClient = null;
let subscriberClient = null;

const getCommandClient = async () => {
  if (commandClient && commandClient.isOpen) return commandClient;
  commandClient = createClient({ url: REDIS_URL, socket: { reconnectStrategy: (r) => Math.min(r * 100, 5000) } });
  commandClient.on('error', (err) => logger.error('Redis command error', { error: err.message }));
  await commandClient.connect();
  return commandClient;
};

const getSubscriberClient = async () => {
  if (subscriberClient && subscriberClient.isOpen) return subscriberClient;
  subscriberClient = createClient({ url: REDIS_URL, socket: { reconnectStrategy: (r) => Math.min(r * 100, 5000) } });
  subscriberClient.on('error', (err) => logger.error('Redis subscriber error', { error: err.message }));
  await subscriberClient.connect();
  return subscriberClient;
};

const closeAll = async () => {
  if (commandClient?.isOpen) await commandClient.quit();
  if (subscriberClient?.isOpen) await subscriberClient.quit();
};

module.exports = { getCommandClient, getSubscriberClient, closeAll };
