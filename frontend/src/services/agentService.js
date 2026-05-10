/**
 * Orion IDE — Agent API Service (Frontend)
 * Uses shared api instance. Auth token attached via AuthContext interceptor.
 */

import api from './api';

/**
 * Start a new pipeline.
 */
export const startPipeline = async (goal) => {
  const res = await api.post('/agents/pipeline/start', { goal });
  return res.data?.data;
};

/**
 * Get pipeline session state.
 */
export const getSession = async (sessionId) => {
  const res = await api.get(`/agents/pipeline/${sessionId}`);
  return res.data?.data;
};

/**
 * Approve the current step.
 */
export const approveStep = async (sessionId, step) => {
  const res = await api.post(`/agents/pipeline/${sessionId}/approve`, { step });
  return res.data?.data;
};

/**
 * Reject the current step with feedback.
 */
export const rejectStep = async (sessionId, step, reason) => {
  const res = await api.post(`/agents/pipeline/${sessionId}/reject`, { step, reason });
  return res.data?.data;
};

/**
 * Open an SSE stream for pipeline updates.
 */
export const streamPipeline = (sessionId, callbacks) => {
  const url = `/api/agents/pipeline/${sessionId}/stream`;
  const eventSource = new EventSource(url, { withCredentials: true });

  const eventTypes = [
    'PIPELINE_STARTED', 'AGENT_THINKING', 'AGENT_COMPLETE',
    'AGENT_ERROR', 'WAITING_APPROVAL', 'STEP_APPROVED',
    'STEP_REJECTED', 'MAX_REJECTIONS', 'STEP_COMPLETE',
    'IMPLEMENTATION_STARTED', 'FILE_PROGRESS', 'REVIEW_COMPLETE',
    'REVIEW_RETRY', 'FILE_WRITTEN', 'ALL_FILES_COMPLETE',
    'PIPELINE_COMPLETE',
  ];

  eventTypes.forEach((type) => {
    eventSource.addEventListener(type, (e) => {
      try {
        const data = JSON.parse(e.data);
        callbacks.onEvent?.(type, data);
      } catch {
        callbacks.onEvent?.(type, { raw: e.data });
      }
    });
  });

  eventSource.onerror = () => {
    callbacks.onError?.({ message: 'Pipeline stream connection lost' });
    eventSource.close();
  };

  return eventSource;
};

export const agentService = { startPipeline, getSession, approveStep, rejectStep, streamPipeline };
