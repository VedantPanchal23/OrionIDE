/**
 * Orion IDE — PubSub Service
 *
 * Redis Pub/Sub for inter-service event broadcasting.
 *
 * Channels:
 *   notif:{userId}   — user-specific events
 *   notif:broadcast   — all-user events
 *
 * Event format: { type, userId, payload, timestamp, requestId }
 */

const { getCommandClient, getSubscriberClient } = require('./redisClient');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('notification-service');

/**
 * Subscribe to a Redis Pub/Sub channel.
 * @param {string} channel
 * @param {(message: object) => void} handler
 */
const subscribe = async (channel, handler) => {
  const subscriber = await getSubscriberClient();
  await subscriber.subscribe(channel, (message) => {
    try {
      const parsed = JSON.parse(message);
      handler(parsed);
    } catch {
      handler({ type: 'RAW', payload: message });
    }
  });
  logger.info('Subscribed to channel', { channel });
};

/**
 * Publish an event to a Redis Pub/Sub channel.
 * @param {string} channel
 * @param {object} event — { type, userId, payload }
 */
const publish = async (channel, event) => {
  const client = await getCommandClient();
  const enriched = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
    requestId: event.requestId || null,
  };
  await client.publish(channel, JSON.stringify(enriched));
  logger.debug('Published event', { channel, type: event.type });
};

/**
 * Publish a user-specific event.
 */
const publishToUser = async (userId, event) => {
  await publish(`notif:${userId}`, { ...event, userId });
};

/**
 * Publish a broadcast event to all users.
 */
const publishBroadcast = async (event) => {
  await publish('notif:broadcast', event);
};

module.exports = { subscribe, publish, publishToUser, publishBroadcast };
