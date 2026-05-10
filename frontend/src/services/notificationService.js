/**
 * Orion IDE — Notification Service (Frontend)
 *
 * SSE client with auto-reconnect and typed event handlers.
 * Uses relative URLs — CRA proxy handles /api → gateway in dev.
 */

let eventSource = null;
const handlers = new Map(); // Map<eventType, Set<handler>>
let reconnectAttempts = 0;
let reconnectTimer = null;

/**
 * Connect to the SSE notification stream.
 * @param {string} token — JWT access token
 */
export const connect = (token) => {
  if (eventSource) disconnect();

  const url = `/api/notifications/stream?token=${encodeURIComponent(token || '')}`;
  eventSource = new EventSource(url, { withCredentials: true });
  reconnectAttempts = 0;

  eventSource.addEventListener('connected', (e) => {
    reconnectAttempts = 0;
    emit('connected', JSON.parse(e.data));
  });

  // Listen for all typed events
  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      emit(data.type, data);
    } catch {
      // Ignore malformed
    }
  };

  // Hook into typed events
  const knownEvents = [
    'DRIVE_FILE_SAVED', 'DRIVE_FILE_CREATED', 'DRIVE_FILE_DELETED',
    'EXECUTION_COMPLETE', 'EXECUTION_FAILED',
    'AGENT_STATUS_CHANGE', 'PIPELINE_COMPLETE',
  ];
  knownEvents.forEach((type) => {
    eventSource.addEventListener(type, (e) => {
      try {
        const data = JSON.parse(e.data);
        emit(type, data);
      } catch {
        emit(type, { raw: e.data });
      }
    });
  });

  eventSource.onerror = () => {
    eventSource.close();
    eventSource = null;
    scheduleReconnect(token);
  };
};

/**
 * Disconnect from the SSE stream.
 */
export const disconnect = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  reconnectAttempts = 0;
};

/**
 * Register a handler for a specific event type.
 */
export const on = (eventType, handler) => {
  if (!handlers.has(eventType)) handlers.set(eventType, new Set());
  handlers.get(eventType).add(handler);
};

/**
 * Remove a handler for a specific event type.
 */
export const off = (eventType, handler) => {
  handlers.get(eventType)?.delete(handler);
};

/**
 * Emit an event to registered handlers.
 */
const emit = (eventType, data) => {
  handlers.get(eventType)?.forEach((h) => {
    try { h(data); } catch { /* handler error */ }
  });
};

/**
 * Auto-reconnect with exponential backoff (max 30s).
 */
const scheduleReconnect = (token) => {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  reconnectAttempts++;
  reconnectTimer = setTimeout(() => connect(token), delay);
};

export const isConnected = () => eventSource?.readyState === EventSource.OPEN;

export const notificationService = { connect, disconnect, on, off, isConnected };
