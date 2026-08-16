import { getAccessToken } from './api';

/**
 * Subscribe to gateway notification SSE.
 * Returns an unsubscribe function.
 */
export function subscribeNotifications({ onEvent, onError } = {}) {
  const token = getAccessToken() || '';
  const url = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);

  const forward = (type) => (e) => {
    try {
      const data = e.data ? JSON.parse(e.data) : {};
      onEvent?.({ type: type || data.type || 'message', ...data });
    } catch {
      onEvent?.({ type: type || 'message', raw: e.data });
    }
  };

  [
    'connected',
    'DRIVE_FILE_CREATED',
    'DRIVE_FILE_UPDATED',
    'DRIVE_FILE_DELETED',
    'DRIVE_FILE_RENAMED',
    'EXECUTION_STARTED',
    'EXECUTION_COMPLETE',
    'EXECUTION_FAILED',
    'PIPELINE_COMPLETE',
    'PIPELINE_FAILED',
    'AGENT_ERROR',
    'message',
  ].forEach((type) => {
    es.addEventListener(type, forward(type));
  });

  es.onmessage = forward('message');
  es.onerror = () => {
    onError?.(new Error('notifications_stream_closed'));
  };

  return () => {
    es.close();
  };
}
