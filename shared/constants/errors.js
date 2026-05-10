/**
 * Orion IDE — Standardized Error Codes
 * 
 * Every service uses these codes in the standard error response format:
 * {
 *   error: {
 *     code: ERROR_CODES.<CODE>,
 *     message: string,
 *     details: object | null
 *   }
 * }
 */

const ERROR_CODES = Object.freeze({
  // ── Generic / Shared ─────────────────────────────────────────────────
  INTERNAL_ERROR:       'INTERNAL_ERROR',
  VALIDATION_ERROR:     'VALIDATION_ERROR',
  NOT_FOUND:            'NOT_FOUND',
  BAD_REQUEST:          'BAD_REQUEST',
  RATE_LIMITED:         'RATE_LIMITED',
  SERVICE_UNAVAILABLE:  'SERVICE_UNAVAILABLE',
  FORBIDDEN:            'FORBIDDEN',
  METHOD_NOT_ALLOWED:   'METHOD_NOT_ALLOWED',

  // ── Auth Service ─────────────────────────────────────────────────────
  AUTH_INVALID:          'AUTH_INVALID',
  AUTH_TOKEN_EXPIRED:    'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_MALFORMED:  'AUTH_TOKEN_MALFORMED',
  AUTH_REFRESH_INVALID:  'AUTH_REFRESH_INVALID',
  AUTH_REFRESH_EXPIRED:  'AUTH_REFRESH_EXPIRED',
  AUTH_GOOGLE_FAILED:    'AUTH_GOOGLE_FAILED',
  AUTH_UNAUTHORIZED:     'AUTH_UNAUTHORIZED',
  AUTH_USER_NOT_FOUND:   'AUTH_USER_NOT_FOUND',

  // ── Drive Service ────────────────────────────────────────────────────
  DRIVE_NOT_FOUND:       'DRIVE_NOT_FOUND',
  DRIVE_FILE_EXISTS:     'DRIVE_FILE_EXISTS',
  DRIVE_PERMISSION:      'DRIVE_PERMISSION',
  DRIVE_QUOTA_EXCEEDED:  'DRIVE_QUOTA_EXCEEDED',
  DRIVE_API_ERROR:       'DRIVE_API_ERROR',
  DRIVE_WRITE_FAILED:    'DRIVE_WRITE_FAILED',
  DRIVE_FOLDER_ERROR:    'DRIVE_FOLDER_ERROR',

  // ── Editor Service ───────────────────────────────────────────────────
  EDITOR_SESSION_ERROR:     'EDITOR_SESSION_ERROR',
  EDITOR_SESSION_NOT_FOUND: 'EDITOR_SESSION_NOT_FOUND',
  EDITOR_WEBSOCKET_ERROR:   'EDITOR_WEBSOCKET_ERROR',

  // ── Execution Service ────────────────────────────────────────────────
  EXECUTION_FAILED:        'EXECUTION_FAILED',
  EXECUTION_TIMEOUT:       'EXECUTION_TIMEOUT',
  EXECUTION_NOT_FOUND:     'EXECUTION_NOT_FOUND',
  EXECUTION_LANGUAGE_INVALID: 'EXECUTION_LANGUAGE_INVALID',
  EXECUTION_PISTON_ERROR:  'EXECUTION_PISTON_ERROR',

  // ── Agent Service ────────────────────────────────────────────────────
  AGENT_FAILED:            'AGENT_FAILED',
  AGENT_SESSION_NOT_FOUND: 'AGENT_SESSION_NOT_FOUND',
  AGENT_APPROVAL_REQUIRED: 'AGENT_APPROVAL_REQUIRED',
  AGENT_LLM_ERROR:         'AGENT_LLM_ERROR',
  AGENT_PIPELINE_ERROR:    'AGENT_PIPELINE_ERROR',
  AGENT_RATE_LIMITED:       'AGENT_RATE_LIMITED',

  // ── Notification Service ─────────────────────────────────────────────
  NOTIFICATION_PUBLISH_FAILED: 'NOTIFICATION_PUBLISH_FAILED',
  NOTIFICATION_STREAM_ERROR:   'NOTIFICATION_STREAM_ERROR',

  // ── API Gateway ──────────────────────────────────────────────────────
  GATEWAY_UPSTREAM_ERROR:  'GATEWAY_UPSTREAM_ERROR',
  GATEWAY_TIMEOUT:         'GATEWAY_TIMEOUT',
});

/**
 * Helper: create a standardized error response object
 * @param {string} code    — one of ERROR_CODES
 * @param {string} message — human-readable description
 * @param {object|null} details — optional extra context
 * @returns {{ error: { code, message, details } }}
 */
const createErrorResponse = (code, message, details = null) => ({
  error: { code, message, details },
});

module.exports = { ERROR_CODES, createErrorResponse };
