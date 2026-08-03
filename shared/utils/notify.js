/**
 * Orion IDE — Internal notification publisher
 * Services call this to push events to notification-service (SSE → browser).
 * Uses native fetch (Node 18+) — no axios dependency.
 */

const NOTIFICATION_URL = (
  process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3006'
).replace(/\/$/, '');

const resolveSecret = () =>
  process.env.INTERNAL_SECRET || process.env.DRIVE_SERVICE_SECRET || '';

/**
 * Publish a typed event to a user (or broadcast).
 * Non-fatal — never throws to callers.
 *
 * @param {object} opts
 * @param {string} opts.type — EVENT_TYPES.*
 * @param {string} [opts.userId]
 * @param {object} [opts.payload]
 * @param {boolean} [opts.broadcast]
 */
const publishEvent = async ({ type, userId, payload = {}, broadcast = false }) => {
  const secret = resolveSecret();
  if (!secret || !type) return false;

  try {
    const res = await fetch(`${NOTIFICATION_URL}/notifications/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secret,
      },
      body: JSON.stringify({ type, userId, payload, broadcast }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
};

module.exports = { publishEvent };
