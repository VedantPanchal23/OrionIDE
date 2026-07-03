/**
 * Orion IDE — Auth Service Routes
 *
 * Endpoints:
 *   GET  /auth/google           → Initiates Google OAuth flow
 *   GET  /auth/google/callback  → Google OAuth callback, issues tokens
 *   POST /auth/refresh          → Refresh access token using httpOnly refresh cookie
 *   POST /auth/logout           → Revoke refresh token, clear cookie
 *   GET  /auth/me               → Get current user info from access token
 *   GET  /auth/validate         → Validates token (used by API Gateway)
 *
 * Security:
 *   - Refresh token stored in httpOnly, SameSite=Strict cookie
 *   - Access token returned in response body (stored in memory by frontend)
 *   - All tokens have jti (JWT ID) for revocation capability
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
} = require('../services/tokenService');
const { ensureOrionFolder } = require('../services/googleService');
const { getRedisClient } = require('../services/redisClient');

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
//
// On success:
//   1. Generate access + refresh tokens
//   2. Store refresh token in Redis
//   3. Set refresh token as httpOnly cookie
//   4. Redirect to frontend with access token in URL param
// ─────────────────────────────────────────────────────────────────────────
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=auth_failed` }),
  async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.redirect(`${FRONTEND_URL}/login?error=no_user`);
      }

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Store refresh token in Redis
      const redis = await getRedisClient();
      await storeRefreshToken(redis, user.userId, refreshToken);

      // Set refresh token as httpOnly cookie
      res.cookie(COOKIE_NAME, refreshToken, COOKIE_OPTIONS);

      // Store Google refresh token in Redis for later token refresh
      if (user.googleRefreshToken) {
        await redis.set(
          `google:refresh:${user.userId}`,
          user.googleRefreshToken,
          { EX: 30 * 24 * 60 * 60 } // 30 days
        );
      }

      // Ensure OrionIDE folder exists (fire and forget — non-blocking)
      ensureOrionFolder(user.googleAccessToken, user.userId).catch(() => {});

      logger.info('User authenticated via Google OAuth', {
        userId: user.userId,
        email: user.email,
      });

      // Redirect to frontend with access token (frontend stores in memory)
      return res.redirect(`${FRONTEND_URL}/auth/success?token=${encodeURIComponent(accessToken)}`);
    } catch (err) {
      logger.error('OAuth callback error', { error: err.message, stack: err.stack });
      return res.redirect(`${FRONTEND_URL}/login?error=server_error`);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// POST /auth/refresh — Refresh access token
//
// Reads refresh token from httpOnly cookie.
// Validates against Redis, issues new access token.
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

    // Verify the JWT signature and expiry
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      // Clear the invalid cookie
      res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: 0 });
      return res.status(401).json({
        error: {
          code: err.code || 'AUTH_REFRESH_INVALID',
          message: err.message || 'Invalid refresh token',
          details: null,
        },
      });
    }

    // Verify the token exists in Redis (not revoked)
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

    // Refresh the Google access token using stored Google refresh token
    let freshGoogleToken = decoded.googleAccessToken;
    try {
      const googleRefreshToken = await redis.get(`google:refresh:${decoded.userId}`);
      if (googleRefreshToken) {
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
        );
        oauth2Client.setCredentials({ refresh_token: googleRefreshToken });
        const { credentials } = await oauth2Client.refreshAccessToken();
        freshGoogleToken = credentials.access_token;
        logger.debug('Google access token refreshed', { userId: decoded.userId });
      }
    } catch (refreshErr) {
      logger.warn('Could not refresh Google access token (non-fatal)', {
        userId: decoded.userId,
        error: refreshErr.message,
      });
      // Non-fatal: use existing token (works for up to 1 hour from last login)
    }

    // Issue new access token with fresh Google access token
    const newAccessToken = generateAccessToken({
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      googleAccessToken: freshGoogleToken,
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
// POST /auth/logout — Revoke refresh token and clear cookie
// ─────────────────────────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAME];

    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        const redis = await getRedisClient();
        await revokeRefreshToken(redis, decoded.userId, refreshToken);
        logger.info('User logged out', { userId: decoded.userId });
      } catch {
        // Token might be expired — just clear the cookie
        logger.debug('Logout with invalid/expired refresh token');
      }
    }

    // Always clear the cookie
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
// GET /auth/me — Get current user info from access token
// ─────────────────────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
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

    return res.json({
      data: {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
      },
    });
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
// GET /auth/validate — Validate token (used by API Gateway)
//
// API Gateway calls this on every request to verify the JWT.
// Returns decoded user payload or 401.
// ─────────────────────────────────────────────────────────────────────────
router.get('/validate', (req, res) => {
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

    return res.json({
      data: {
        id: decoded.userId,
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        googleAccessToken: decoded.googleAccessToken,
      },
    });
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
// GET /auth/dev-login — Developer mock login bypass
// ─────────────────────────────────────────────────────────────────────────
router.get('/dev-login', async (req, res) => {
  try {
    const user = {
      userId: 'dev-user-123',
      email: 'developer@orion.dev',
      name: 'Developer Mode',
      picture: 'https://api.dicebear.com/7.x/bottts/svg?seed=Developer',
      googleAccessToken: 'mock-token',
      googleRefreshToken: 'mock-refresh-token',
      provider: 'google',
    };

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token in Redis
    const redis = await getRedisClient();
    await storeRefreshToken(redis, user.userId, refreshToken);

    // Set refresh token as httpOnly cookie
    res.cookie(COOKIE_NAME, refreshToken, COOKIE_OPTIONS);

    // Ensure OrionIDE folder exists (mock-token will trigger local mock directories)
    ensureOrionFolder(user.googleAccessToken, user.userId).catch(() => {});

    logger.info('Developer logged in bypass mode', {
      userId: user.userId,
      email: user.email,
    });

    // Redirect to frontend auth success page
    return res.redirect(`${FRONTEND_URL}/auth/success?token=${encodeURIComponent(accessToken)}`);
  } catch (err) {
    logger.error('Dev login error', { error: err.message, stack: err.stack });
    return res.redirect(`${FRONTEND_URL}/login?error=server_error`);
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
