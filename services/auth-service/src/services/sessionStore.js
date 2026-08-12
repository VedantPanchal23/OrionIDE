/**
 * Orion IDE — Session Store (Redis)
 *
 * Production session secrets live here — never in JWTs or browser-visible URLs.
 *
 * Keys:
 *   google:access:{userId}   — Google OAuth access token (TTL ~1h)
 *   google:refresh:{userId}  — Google OAuth refresh token (TTL 30d)
 *   auth:code:{codeHash}     — one-time handoff code → access JWT (TTL 90s)
 */

const crypto = require('crypto');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('auth-service');

const GOOGLE_ACCESS_TTL_SECONDS = Number(process.env.GOOGLE_ACCESS_TTL_SECONDS) || 55 * 60; // ~55m
const GOOGLE_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const AUTH_CODE_TTL_SECONDS = Number(process.env.AUTH_CODE_TTL_SECONDS) || 90;

const googleAccessKey = (userId) => `google:access:${userId}`;
const googleRefreshKey = (userId) => `google:refresh:${userId}`;
const authCodeKey = (codeHash) => `auth:code:${codeHash}`;

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

/**
 * Persist Google access token for a user (server-side only).
 */
const storeGoogleAccessToken = async (redis, userId, accessToken) => {
  if (!userId || !accessToken) return;
  await redis.set(googleAccessKey(userId), accessToken, { EX: GOOGLE_ACCESS_TTL_SECONDS });
};

/**
 * Persist Google refresh token for silent Google token renewal.
 */
const storeGoogleRefreshToken = async (redis, userId, refreshToken) => {
  if (!userId || !refreshToken) return;
  await redis.set(googleRefreshKey(userId), refreshToken, { EX: GOOGLE_REFRESH_TTL_SECONDS });
};

const getGoogleAccessToken = async (redis, userId) => {
  if (!userId) return null;
  return redis.get(googleAccessKey(userId));
};

const getGoogleRefreshToken = async (redis, userId) => {
  if (!userId) return null;
  return redis.get(googleRefreshKey(userId));
};

/**
 * Clear Google tokens on logout (revokes Drive access for this session store).
 */
const clearGoogleTokens = async (redis, userId) => {
  if (!userId) return;
  await redis.del([googleAccessKey(userId), googleRefreshKey(userId)]);
  logger.debug('Google tokens cleared', { userId });
};

/**
 * Create a single-use, short-lived auth handoff code.
 * Frontend exchanges this for the access JWT — never put JWTs in redirect URLs.
 *
 * @returns {Promise<string>} URL-safe opaque code
 */
const createAuthCode = async (redis, accessToken, userId) => {
  const code = crypto.randomBytes(32).toString('base64url');
  const key = authCodeKey(hashCode(code));
  await redis.set(
    key,
    JSON.stringify({ accessToken, userId, createdAt: new Date().toISOString() }),
    { EX: AUTH_CODE_TTL_SECONDS }
  );
  return code;
};

/**
 * Consume a one-time auth code. Returns null if missing, expired, or already used.
 * @returns {Promise<{ accessToken: string, userId: string }|null>}
 */
const exchangeAuthCode = async (redis, code) => {
  if (!code || typeof code !== 'string' || code.length < 16 || code.length > 128) {
    return null;
  }

  const key = authCodeKey(hashCode(code));
  let raw;
  if (typeof redis.getDel === 'function') {
    raw = await redis.getDel(key);
  } else if (typeof redis.eval === 'function') {
    // Atomic get-and-delete via Lua when getDel is unavailable
    raw = await redis.eval(
      "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]) end; return v",
      { keys: [key] }
    );
  } else {
    // Last resort — small race window; prefer Redis builds with getDel/eval
    raw = await redis.get(key);
    if (raw) await redis.del(key);
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Ensure a fresh Google access token is available, refreshing via Google if needed.
 * @returns {Promise<string|null>}
 */
const resolveGoogleAccessToken = async (redis, userId) => {
  let access = await getGoogleAccessToken(redis, userId);
  if (access) return access;

  const refreshToken = await getGoogleRefreshToken(redis, userId);
  if (!refreshToken) return null;

  try {
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    access = credentials.access_token;
    if (access) {
      await storeGoogleAccessToken(redis, userId, access);
      logger.debug('Google access token renewed from refresh token', { userId });
    }
    return access || null;
  } catch (err) {
    logger.warn('Failed to renew Google access token', {
      userId,
      error: err.message,
    });
    return null;
  }
};

module.exports = {
  storeGoogleAccessToken,
  storeGoogleRefreshToken,
  getGoogleAccessToken,
  getGoogleRefreshToken,
  clearGoogleTokens,
  createAuthCode,
  exchangeAuthCode,
  resolveGoogleAccessToken,
  _config: {
    GOOGLE_ACCESS_TTL_SECONDS,
    GOOGLE_REFRESH_TTL_SECONDS,
    AUTH_CODE_TTL_SECONDS,
  },
};
