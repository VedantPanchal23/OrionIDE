/**
 * Orion IDE — Execution API Service
 *
 * Uses shared api instance. Auth token attached via AuthContext interceptor.
 */

import api from './api';

/**
 * Submit code for execution.
 * @returns {Promise<{ executionId: string }>}
 */
export const executeFile = async (language, fileName, code, stdin = '') => {
  const res = await api.post('/execute', {
    language, fileName, code, stdin,
  });
  return res.data?.data;
};

/**
 * Open an SSE stream for execution output.
 *
 * Note: EventSource doesn't support custom headers, so SSE endpoints
 * must accept auth via cookie or query param. For now we use the
 * relative URL which goes through the proxy.
 *
 * @param {string} executionId
 * @param {{ onStdout, onStderr, onExit, onError }} callbacks
 * @returns {EventSource} — caller can close with .close()
 */
export const streamExecution = (executionId, callbacks) => {
  const url = `/api/execute/${executionId}/stream`;
  const eventSource = new EventSource(url, { withCredentials: true });

  eventSource.addEventListener('stdout', (e) => {
    callbacks.onStdout?.(e.data);
  });

  eventSource.addEventListener('stderr', (e) => {
    callbacks.onStderr?.(e.data);
  });

  eventSource.addEventListener('exit', (e) => {
    try {
      const data = JSON.parse(e.data);
      callbacks.onExit?.(data);
    } catch {
      callbacks.onExit?.({ exitCode: -1 });
    }
    eventSource.close();
  });

  eventSource.addEventListener('error', (e) => {
    if (e.data) {
      try {
        const data = JSON.parse(e.data);
        callbacks.onError?.(data);
      } catch {
        callbacks.onError?.({ message: 'Unknown error' });
      }
    }
    eventSource.close();
  });

  eventSource.onerror = () => {
    callbacks.onError?.({ message: 'Connection lost' });
    eventSource.close();
  };

  return eventSource;
};

/**
 * Get available languages from Piston.
 */
export const getLanguages = async () => {
  const res = await api.get('/execute/languages');
  return res.data?.data;
};

export const executionService = { executeFile, streamExecution, getLanguages };
