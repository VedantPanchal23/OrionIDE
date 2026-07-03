/**
 * Orion IDE — Drive Client Factory
 *
 * Creates authenticated Google Drive API v3 clients.
 * Each request gets its own client using the user's Google access token
 * (extracted from the JWT by the API Gateway).
 */

const { google } = require('googleapis');
const { createMockDriveClient } = require('./mockDrive');

/**
 * Create an authenticated Google Drive API v3 client.
 *
 * @param {string} googleAccessToken — user's Google OAuth access token
 * @returns {import('googleapis').drive_v3.Drive} Drive API client
 */
const createDriveClient = (googleAccessToken) => {
  if (!googleAccessToken) {
    throw new Error('Google access token is required to create Drive client');
  }

  if (googleAccessToken === 'mock-token') {
    return createMockDriveClient();
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: googleAccessToken });

  return google.drive({ version: 'v3', auth });
};

/**
 * MIME types used by Orion IDE in Google Drive.
 */
const MIME_TYPES = {
  FOLDER: 'application/vnd.google-apps.folder',
  PLAIN_TEXT: 'text/plain',
  JAVASCRIPT: 'application/javascript',
  JSON: 'application/json',
  HTML: 'text/html',
  CSS: 'text/css',
  MARKDOWN: 'text/markdown',
};

/**
 * Map file extensions to MIME types for uploads.
 * @param {string} filename
 * @returns {string} MIME type
 */
const getMimeType = (filename) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeMap = {
    js: MIME_TYPES.JAVASCRIPT,
    jsx: MIME_TYPES.JAVASCRIPT,
    ts: MIME_TYPES.JAVASCRIPT,
    tsx: MIME_TYPES.JAVASCRIPT,
    json: MIME_TYPES.JSON,
    html: MIME_TYPES.HTML,
    htm: MIME_TYPES.HTML,
    css: MIME_TYPES.CSS,
    md: MIME_TYPES.MARKDOWN,
  };
  return mimeMap[ext] || MIME_TYPES.PLAIN_TEXT;
};

module.exports = { createDriveClient, MIME_TYPES, getMimeType };
