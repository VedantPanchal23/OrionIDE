/**
 * Orion IDE — Auth Service Routes
 *
 * Endpoints:
 *   GET  /auth/google           → Initiates Google OAuth flow
 *   GET  /auth/google/callback  → Google OAuth callback, issues one-time code
 *   POST /auth/exchange         → Exchange one-time code for access JWT
 *   POST /auth/refresh          → Refresh access token using httpOnly refresh cookie
 *   POST /auth/logout           → Revoke refresh token, clear cookie + Google tokens
 *   GET  /auth/me               → Get current user info from access token
 *   GET  /auth/validate         → Validates token (used by API Gateway); attaches Google token from Redis
 *
 * Security (production SaaS):
 *   - JWTs carry identity only — never Google OAuth secrets
 *   - Google tokens stored in Redis, keyed by userId
 *   - OAuth redirect uses a one-time code (not ?token= JWT in the URL)
 *   - Refresh token stored in httpOnly, SameSite cookie
 *   - Access token returned in response body (memory / sessionStorage by frontend)
 */

const express = require('express');
const passport = require('passport');
const { createLogger } = require('../../../../shared/utils/logger');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  isRefreshTokenValid,
  denyAccessJti,
  isAccessJtiDenied,
} = require('../services/tokenService');
const {
  storeGoogleAccessToken,
  storeGoogleRefreshToken,
  clearGoogleTokens,
  createAuthCode,
  exchangeAuthCode,
  resolveGoogleAccessToken,
} = require('../services/sessionStore');
const { ensureOrionFolder } = require('../services/googleService');
const { getRedisClient } = require('../services/redisClient');
const { publishEvent } = require('../../../../shared/utils/notify');
const { EVENT_TYPES } = require('../../../../shared/constants/events');
const { upsertUser, getUserById, updateProfile } = require('../services/userService');
const { getEntitlements } = require('../services/billingService');

const logger = createLogger('auth-service');
const router = express.Router();

// ── Constants ────────────────────────────────────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3010';
const COOKIE_NAME = 'orion_refresh_token';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Cookie options for the refresh token.
 * httpOnly: prevents XSS access
 * sameSite: prevents CSRF
 * secure: HTTPS only in production
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

/**
 * Complete a successful login: issue JWTs, store secrets in Redis, redirect with one-time code.
 */
const completeLoginRedirect = async (res, user) => {
  const redis = await getRedisClient();

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await storeRefreshToken(redis, user.userId, refreshToken);
  await storeGoogleAccessToken(redis, user.userId, user.googleAccessToken);
  if (user.googleRefreshToken) {
    await storeGoogleRefreshToken(redis, user.userId, user.googleRefreshToken);
  }

  // Persist identity in Postgres (best-effort)
  upsertUser({
    userId: user.userId,
    email: user.email,
    name: user.name,
    picture: user.picture,
  }).catch((err) => logger.warn('User upsert failed', { error: err.message }));

  res.cookie(COOKIE_NAME, refreshToken, COOKIE_OPTIONS);

  // Non-blocking Drive bootstrap
  ensureOrionFolder(user.googleAccessToken, user.userId).catch(() => {});

  const code = await createAuthCode(redis, accessToken, user.userId);
  return res.redirect(`${FRONTEND_URL}/auth/success?code=${encodeURIComponent(code)}`);
};

// ─────────────────────────────────────────────────────────────────────────
// GET /auth/google — Initiate Google OAuth flow
// ─────────────────────────────────────────────────────────────────────────
router.get('/google', passport.authenticate('google', {
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/drive',
  ],
  accessType: 'offline',
  prompt: 'consent',
  session: false,
}));

// ─────────────────────────────────────────────────────────────────────────
// GET /auth/google/callback — Google OAuth callback
// ─────────────────────────────────────────────────────────────────────────
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=auth_failed` }),
  async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.redirect(`${FRONTEND_URL}/login?error=no_user`);
      }

      logger.info('User authenticated via Google OAuth', {
        userId: user.userId,
        email: user.email,
      });

      return completeLoginRedirect(res, user);
    } catch (err) {
      logger.error('OAuth callback error', { error: err.message, stack: err.stack });
      return res.redirect(`${FRONTEND_URL}/login?error=server_error`);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// POST /auth/exchange — One-time code → access JWT
//
// Frontend lands on /auth/success?code=... and POSTs here.
// Code is single-use and expires in ~90s. Never logs the code or JWT.
// ─────────────────────────────────────────────────────────────────────────
router.post('/exchange', async (req, res) => {
  try {
    const code = req.body?.code;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        error: {
          code: 'AUTH_CODE_REQUIRED',
          message: 'Auth code is required',
          details: null,
        },
      });
    }

    let redis;
    try {
      redis = await getRedisClient();
    } catch (redisErr) {
      logger.error('Redis unavailable for auth exchange', { error: redisErr.message });
      return res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Authentication service temporarily unavailable',
          details: null,
        },
      });
    }

    const exchanged = await exchangeAuthCode(redis, code);

    if (!exchanged?.accessToken) {
      return res.status(401).json({
        error: {
          code: 'AUTH_CODE_INVALID',
          message: 'Auth code is invalid, expired, or already used',
          details: null,
        },
      });
    }

    // Verify the embedded access JWT is still valid before handing it out
    try {
      verifyAccessToken(exchanged.accessToken);
    } catch (err) {
      return res.status(401).json({
        error: {
          code: err.code || 'AUTH_INVALID',
          message: err.message || 'Invalid access token',
          details: null,
        },
      });
    }

    logger.info('Auth code exchanged', { userId: exchanged.userId });

    publishEvent({
      type: EVENT_TYPES.USER_LOGGED_IN,
      userId: exchanged.userId,
      payload: {},
    }).catch(() => {});

    return res.json({
      data: {
        accessToken: exchanged.accessToken,
      },
    });
  } catch (err) {
    logger.error('Auth code exchange error', { error: err.message });
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to exchange auth code',
        details: null,
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /auth/refresh — Refresh access token
// ─────────────────────────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAME];

    if (!refreshToken) {
      return res.status(401).json({
        error: {
          code: 'AUTH_NO_REFRESH_TOKEN',
          message: 'No refresh token provided',
          details: null,
        },
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: 0 });
      return res.status(401).json({
        error: {
          code: err.code || 'AUTH_REFRESH_INVALID',
          message: err.message || 'Invalid refresh token',
          details: null,
        },
      });
    }

    const redis = await getRedisClient();
    const isValid = await isRefreshTokenValid(redis, decoded.userId, refreshToken);

    if (!isValid) {
      res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: 0 });
      return res.status(401).json({
        error: {
          code: 'AUTH_REFRESH_REVOKED',
          message: 'Refresh token has been revoked',
          details: null,
        },
      });
    }

    // Renew Google access token in Redis (identity JWT stays slim)
    await resolveGoogleAccessToken(redis, decoded.userId);

    const newAccessToken = generateAccessToken({
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    });

    logger.info('Access token refreshed', { userId: decoded.userId });

    return res.json({
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (err) {
    logger.error('Token refresh error', { error: err.message });
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to refresh token',
        details: null,
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /auth/logout — Revoke refresh + access jti, clear cookie + Google tokens
// ─────────────────────────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const redis = await getRedisClient();
    const refreshToken = req.cookies?.[COOKIE_NAME];
    const accessToken = extractBearerToken(req);
    let userId = null;

    if (accessToken) {
      try {
        const decoded = verifyAccessToken(accessToken);
        userId = decoded.userId;
        await denyAccessJti(redis, decoded.jti, decoded.exp);
      } catch {
        // Expired/invalid access token — still clear refresh/cookie
        try {
          const jwt = require('jsonwebtoken');
          const loose = jwt.decode(accessToken);
          if (loose?.jti) {
            await denyAccessJti(redis, loose.jti, loose.exp);
            userId = loose.userId || userId;
          }
        } catch {
          // ignore
        }
      }
    }

    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        userId = decoded.userId || userId;
        await revokeRefreshToken(redis, decoded.userId, refreshToken);
        await clearGoogleTokens(redis, decoded.userId);
      } catch {
        logger.debug('Logout with invalid/expired refresh token');
      }
    } else if (userId) {
      await clearGoogleTokens(redis, userId).catch(() => {});
    }

    if (userId) {
      logger.info('User logged out', { userId });
      publishEvent({
        type: EVENT_TYPES.USER_LOGGED_OUT,
        userId,
        payload: {},
      }).catch(() => {});
    }

    res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: 0 });

    return res.json({
      data: {
        message: 'Logged out successfully',
      },
    });
  } catch (err) {
    logger.error('Logout error', { error: err.message });
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Logout failed',
        details: null,
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /auth/me — Get current user info (+ plan/preferences when DB available)
// ─────────────────────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      return res.status(401).json({
        error: {
          code: 'AUTH_INVALID',
          message: 'No authentication token provided',
          details: null,
        },
      });
    }

    const decoded = verifyAccessToken(token);
    let profile = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    };

    try {
      const dbUser = await getUserById(decoded.userId);
      if (dbUser) {
        profile = {
          ...profile,
          name: dbUser.name || profile.name,
          picture: dbUser.picture || profile.picture,
          preferences: dbUser.preferences,
          planId: dbUser.planId,
          createdAt: dbUser.createdAt,
        };
      }
      profile.entitlements = await getEntitlements(decoded.userId);
    } catch {
      // DB optional
    }

    return res.json({ data: profile });
  } catch (err) {
    return res.status(401).json({
      error: {
        code: err.code || 'AUTH_INVALID',
        message: err.message || 'Invalid or expired token',
        details: null,
      },
    });
  }
});

// GET /auth/profile — Return user profile (same data as validate, without googleAccessToken)
router.get('/profile', async (req, res) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({
        error: { code: 'AUTH_INVALID', message: 'No authentication token provided', details: null },
      });
    }
    const decoded = verifyAccessToken(token);
    let profile = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    };
    try {
      const dbUser = await getUserById(decoded.userId);
      if (dbUser) {
        profile = {
          ...profile,
          name: dbUser.name || profile.name,
          picture: dbUser.picture || profile.picture,
          preferences: dbUser.preferences,
          planId: dbUser.planId,
          createdAt: dbUser.createdAt,
        };
      }
      profile.entitlements = await getEntitlements(decoded.userId);
    } catch { /* DB optional */ }
    return res.json({ data: profile });
  } catch (err) {
    return res.status(401).json({
      error: { code: err.code || 'AUTH_INVALID', message: err.message || 'Invalid or expired token', details: null },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PATCH /auth/profile — Update display name / preferences (requires Postgres)
// ─────────────────────────────────────────────────────────────────────────
router.patch('/profile', async (req, res) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({
        error: { code: 'AUTH_INVALID', message: 'No authentication token provided', details: null },
      });
    }
    const decoded = verifyAccessToken(token);
    const updated = await updateProfile(decoded.userId, {
      name: req.body?.name,
      preferences: req.body?.preferences,
    });
    return res.json({ data: updated });
  } catch (err) {
    return res.status(err.status || 500).json({
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Profile update failed',
        details: null,
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /auth/validate — Validate token (used by API Gateway)
//
// Identity is always returned. Google access token is ONLY included when the
// caller presents INTERNAL_SECRET (gateway → auth). Browsers must use /profile.
// ─────────────────────────────────────────────────────────────────────────
router.get('/validate', async (req, res) => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      return res.status(401).json({
        error: {
          code: 'AUTH_INVALID',
          message: 'No authentication token provided',
          details: null,
        },
      });
    }

    const decoded = verifyAccessToken(token);
    const redis = await getRedisClient();

    let denied = false;
    try {
      denied = await isAccessJtiDenied(redis, decoded.jti);
    } catch (redisErr) {
      // Denylist is best-effort — Redis outages must not reject valid JWTs as "invalid"
      logger.warn('Access denylist check failed — continuing', {
        userId: decoded.userId,
        error: redisErr.message,
      });
    }
    if (denied) {
      return res.status(401).json({
        error: {
          code: 'AUTH_TOKEN_REVOKED',
          message: 'Access token has been revoked',
          details: null,
        },
      });
    }

    const { isInternalCaller } = require('../../../../shared/utils/internalAuth');
    const internal = isInternalCaller(req);

    let googleAccessToken = null;
    if (internal) {
      try {
        googleAccessToken = await resolveGoogleAccessToken(redis, decoded.userId);
      } catch (redisErr) {
        logger.warn('Could not resolve Google access token during validate', {
          userId: decoded.userId,
          error: redisErr.message,
        });
      }
    }

    let planId = null;
    let entitlements = null;
    try {
      const dbUser = await getUserById(decoded.userId);
      planId = dbUser?.planId || null;
      entitlements = await getEntitlements(decoded.userId);
    } catch {
      // optional
    }

    const payload = {
      id: decoded.userId,
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      planId,
      entitlements,
    };
    if (internal) {
      payload.googleAccessToken = googleAccessToken;
    }

    return res.json({ data: payload });
  } catch (err) {
    return res.status(401).json({
      error: {
        code: err.code || 'AUTH_INVALID',
        message: err.message || 'Invalid or expired token',
        details: null,
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /auth/internal/google-token — mesh-only fresh Google access token
// Used by terminal-service auto-push / agent when the cached token may be stale.
// ─────────────────────────────────────────────────────────────────────────
router.get('/internal/google-token', async (req, res) => {
  const { isInternalCaller } = require('../../../../shared/utils/internalAuth');
  if (!isInternalCaller(req)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN_INTERNAL', message: 'Internal secret required', details: null },
    });
  }

  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) {
    return res.status(400).json({
      error: { code: 'AUTH_MISSING_USER', message: 'X-User-Id required', details: null },
    });
  }

  try {
    const redis = await getRedisClient();
    const googleAccessToken = await resolveGoogleAccessToken(redis, userId);
    if (!googleAccessToken) {
      return res.status(404).json({
        error: {
          code: 'GOOGLE_TOKEN_UNAVAILABLE',
          message: 'No Google access token — user must re-login',
          details: null,
        },
      });
    }
    return res.json({ data: { userId, googleAccessToken } });
  } catch (err) {
    logger.error('internal google-token failed', { userId, error: err.message });
    return res.status(503).json({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Could not resolve Google token', details: null },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Helper: Extract Bearer token from Authorization header
// ─────────────────────────────────────────────────────────────────────────
const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
};

module.exports = router;
