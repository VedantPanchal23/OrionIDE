/**
 * Orion IDE — Shared Event Type Constants
 * 
 * Used by all services for inter-service communication via Redis Pub/Sub.
 * Every event published to the notification-service must use one of these types.
 * 
 * Event payload format:
 * {
 *   type: EVENT_TYPES.<TYPE>,
 *   userId: string,
 *   payload: object,
 *   timestamp: ISO string
 * }
 */

const EVENT_TYPES = Object.freeze({
  // ── Agent Pipeline Events ─────────────────────────────────────────────
  AGENT_PIPELINE_STARTED:   'AGENT_PIPELINE_STARTED',
  AGENT_PIPELINE_COMPLETED: 'AGENT_PIPELINE_COMPLETED',
  AGENT_PIPELINE_FAILED:    'AGENT_PIPELINE_FAILED',
  AGENT_STATUS_CHANGE:      'AGENT_STATUS_CHANGE',
  AGENT_STEP_COMPLETED:     'AGENT_STEP_COMPLETED',
  AGENT_AWAITING_APPROVAL:  'AGENT_AWAITING_APPROVAL',
  AGENT_APPROVED:           'AGENT_APPROVED',
  AGENT_REJECTED:           'AGENT_REJECTED',

  // ── File / Drive Events ───────────────────────────────────────────────
  FILE_CREATED:    'FILE_CREATED',
  FILE_UPDATED:    'FILE_UPDATED',
  FILE_DELETED:    'FILE_DELETED',
  FILE_RENAMED:    'FILE_RENAMED',
  FILE_SAVED:      'FILE_SAVED',
  FILE_SAVE_ERROR: 'FILE_SAVE_ERROR',
  FOLDER_CREATED:  'FOLDER_CREATED',

  // ── Editor Events ────────────────────────────────────────────────────
  EDITOR_SESSION_OPENED: 'EDITOR_SESSION_OPENED',
  EDITOR_SESSION_CLOSED: 'EDITOR_SESSION_CLOSED',
  EDITOR_CURSOR_MOVED:   'EDITOR_CURSOR_MOVED',

  // ── Execution Events ─────────────────────────────────────────────────
  EXECUTION_STARTED:   'EXECUTION_STARTED',
  EXECUTION_COMPLETE:  'EXECUTION_COMPLETE',
  EXECUTION_FAILED:    'EXECUTION_FAILED',
  EXECUTION_TIMEOUT:   'EXECUTION_TIMEOUT',

  // ── Auth Events ───────────────────────────────────────────────────────
  USER_LOGGED_IN:  'USER_LOGGED_IN',
  USER_LOGGED_OUT: 'USER_LOGGED_OUT',

  // ── System Events ────────────────────────────────────────────────────
  ERROR:               'ERROR',
  SERVICE_HEALTH_CHECK: 'SERVICE_HEALTH_CHECK',
});

// Redis Pub/Sub channel name for notifications
const NOTIFICATION_CHANNEL = 'orion:notifications';

module.exports = { EVENT_TYPES, NOTIFICATION_CHANNEL };
