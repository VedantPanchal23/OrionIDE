/**
 * Orion IDE — Google OAuth Service
 *
 * Passport.js Google OAuth 2.0 strategy configuration.
 * Handles user profile extraction and session serialization.
 *
 * On successful Google login:
 *   1. Extracts user profile (id, email, name, picture)
 *   2. Captures Google access token (for Drive API calls)
 *   3. Passes user object to Passport done() callback
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const axios = require('axios');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('auth-service');

// ── Configuration ────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';
const DRIVE_SERVICE_URL = process.env.DRIVE_SERVICE_URL || 'http://drive-service:3002';

/**
 * Configure Passport with Google OAuth 2.0 strategy.
 *
 * Scopes requested:
 *   - profile: name and picture
 *   - email: email address
 *   - drive.file: access to files created by Orion IDE in Google Drive
 */
const configurePassport = () => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    logger.warn('Google OAuth credentials not configured — OAuth login will fail');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive'],
        accessType: 'offline',    // Get refresh token for offline access
        prompt: 'consent',         // Always show consent screen to get refresh token
      },
      (accessToken, refreshToken, profile, done) => {
        try {
          // Extract normalized user object from Google profile
          const user = extractUserProfile(profile, accessToken, refreshToken);
          logger.info('Google OAuth successful', { userId: user.userId, email: user.email });
          return done(null, user);
        } catch (err) {
          logger.error('Google OAuth profile extraction failed', { error: err.message });
          return done(err, null);
        }
      }
    )
  );

  // Serialize user for session (we use JWTs, so this is minimal)
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  // Deserialize user from session
  passport.deserializeUser((user, done) => {
    done(null, user);
  });

  logger.info('Google OAuth strategy configured');
};

/**
 * Extract a normalized user profile from the Google OAuth response.
 *
 * @param {object} profile — Passport Google profile object
 * @param {string} accessToken — Google access token (for Drive API)
 * @param {string} refreshToken — Google refresh token (for offline access)
 * @returns {object} Normalized user object
 */
const extractUserProfile = (profile, accessToken, refreshToken) => {
  return {
    userId: profile.id,
    email: profile.emails?.[0]?.value || null,
    name: profile.displayName || null,
    picture: profile.photos?.[0]?.value || null,
    googleAccessToken: accessToken,
    googleRefreshToken: refreshToken || null,
    provider: 'google',
  };
};

/**
 * Ensure the OrionIDE/ root folder exists in the user's Google Drive.
 * Calls drive-service to create the folder if it doesn't exist.
 *
 * This is called after successful authentication to bootstrap the workspace.
 *
 * @param {string} googleAccessToken — user's Google access token
 * @param {string} userId — user's ID
 */
const ensureOrionFolder = async (googleAccessToken, userId) => {
  try {
    await axios.post(
      `${DRIVE_SERVICE_URL}/drive/ensure-root`,
      { googleAccessToken },
      {
        headers: {
          'X-User-Id': userId,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    logger.info('OrionIDE folder ensured', { userId });
  } catch (err) {
    // Non-fatal: user can still use the IDE, folder will be created on first file operation
    logger.warn('Failed to ensure OrionIDE folder (non-fatal)', {
      userId,
      error: err.message,
    });
  }
};

module.exports = {
  configurePassport,
  extractUserProfile,
  ensureOrionFolder,
};
