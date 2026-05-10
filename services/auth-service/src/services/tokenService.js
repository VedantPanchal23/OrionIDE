/**
 * Orion IDE — Token Service
 *
 * JWT creation, verification, refresh, and revocation logic.
 *
 * Token types:
 *   Access token  — short-lived (15m), signed with JWT_SECRET
 *   Refresh token — long-lived (7d), signed with JWT_REFRESH_SECRET, stored in Redis
 *
 * Token payload shape:
 *   { userId, email, name, picture, googleAccessToken, jti }
 *
 * Redis key pattern:
 *   auth:refresh:{userId}:{tokenHash}  — TTL matches token expiry
 *   Multiple sessions per user supported (multiple devices)
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('auth-service');

// ── Configuration ────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

// Convert expiry string to seconds for Redis TTL
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Hash a token for safe Redis storage (don't store raw tokens).
 * @param {string} token
 * @returns {string} SHA-256 hash
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Build the standardized JWT payload from a user object.
 * @param {object} user
 * @returns {object} payload
 */
const buildPayload = (user) => ({
  userId: user.userId || user.id,
  email: user.email,
  name: user.name || user.displayName,
  picture: user.picture || user.photos?.[0]?.value || null,
  googleAccessToken: user.googleAccessToken || null,
});

/**
 * Generate a short-lived access token.
 * @param {object} user — { userId, email, name, picture, googleAccessToken }
 * @returns {string} JWT access token
 */
const generateAccessToken = (user) => {
  const payload = buildPayload(user);
  const jti = uuidv4(); // Unique token ID for potential revocation

  return jwt.sign(
    { ...payload, jti, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRY }
  );
};

/**
 * Generate a long-lived refresh token.
 * @param {object} user — { userId, email, name, picture }
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (user) => {
  const payload = buildPayload(user);
  const jti = uuidv4();

  return jwt.sign(
    { ...payload, jti, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY }
  );
};

/**
 * Verify and decode an access token.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws {Error} if token is invalid, expired, or tampered
 */
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type: expected access token');
    }
    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const error = new Error('Access token expired');
      error.code = 'AUTH_TOKEN_EXPIRED';
      throw error;
    }
    if (err.name === 'JsonWebTokenError') {
      const error = new Error('Invalid access token');
      error.code = 'AUTH_TOKEN_MALFORMED';
      throw error;
    }
    throw err;
  }
};

/**
 * Verify and decode a refresh token.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws {Error} if token is invalid or expired
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type: expected refresh token');
    }
    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const error = new Error('Refresh token expired');
      error.code = 'AUTH_REFRESH_EXPIRED';
      throw error;
    }
    if (err.name === 'JsonWebTokenError') {
      const error = new Error('Invalid refresh token');
      error.code = 'AUTH_REFRESH_INVALID';
      throw error;
    }
    throw err;
  }
};

/**
 * Store a refresh token in Redis.
 * Key pattern: auth:refresh:{userId}:{tokenHash}
 * Supports multiple sessions (multiple devices) per user.
 *
 * @param {object} redisClient — connected Redis client
 * @param {string} userId
 * @param {string} token — raw refresh token (stored as hash)
 */
const storeRefreshToken = async (redisClient, userId, token) => {
  const tokenHash = hashToken(token);
  const key = `auth:refresh:${userId}:${tokenHash}`;

  await redisClient.set(key, JSON.stringify({
    userId,
    createdAt: new Date().toISOString(),
  }), {
    EX: REFRESH_TTL_SECONDS,
  });

  logger.debug('Refresh token stored', { userId, key });
};

/**
 * Check if a refresh token is still valid in Redis.
 * @param {object} redisClient
 * @param {string} userId
 * @param {string} token — raw refresh token
 * @returns {boolean}
 */
const isRefreshTokenValid = async (redisClient, userId, token) => {
  const tokenHash = hashToken(token);
  const key = `auth:refresh:${userId}:${tokenHash}`;

  const exists = await redisClient.exists(key);
  return exists === 1;
};

/**
 * Revoke a specific refresh token (logout from one device).
 * @param {object} redisClient
 * @param {string} userId
 * @param {string} token — raw refresh token
 */
const revokeRefreshToken = async (redisClient, userId, token) => {
  const tokenHash = hashToken(token);
  const key = `auth:refresh:${userId}:${tokenHash}`;

  await redisClient.del(key);
  logger.debug('Refresh token revoked', { userId, key });
};

/**
 * Revoke ALL refresh tokens for a user (logout from all devices).
 * @param {object} redisClient
 * @param {string} userId
 */
const revokeAllRefreshTokens = async (redisClient, userId) => {
  const pattern = `auth:refresh:${userId}:*`;
  let cursor = 0;
  let deleted = 0;

  do {
    const result = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
    cursor = result.cursor;

    if (result.keys.length > 0) {
      await redisClient.del(result.keys);
      deleted += result.keys.length;
    }
  } while (cursor !== 0);

  logger.info('All refresh tokens revoked', { userId, count: deleted });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  storeRefreshToken,
  isRefreshTokenValid,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  hashToken,
  buildPayload,
  // Exported for testing
  _config: { JWT_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY },
};
