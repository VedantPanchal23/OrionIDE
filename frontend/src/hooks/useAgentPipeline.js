/**
 * Orion IDE — useAgentPipeline Hook
 *
 * Manages pipeline state, SSE streaming, and step approval/rejection.
 */

import { useState, useCallback, useRef } from 'react';
import { startPipeline, getSession, approveStep, rejectStep, streamPipeline } from '../services/agentService';

const useAgentPipeline = () => {
  const [session, setSession] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  const connectStream = useCallback((sessionId) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    eventSourceRef.current = streamPipeline(sessionId, {
      onEvent: (type, data) => {
        // Refresh session on significant events
        if (['AGENT_COMPLETE', 'WAITING_APPROVAL', 'STEP_APPROVED', 'AGENT_ERROR', 'MAX_REJECTIONS', 'FILE_PROGRESS', 'REVIEW_COMPLETE', 'FILE_WRITTEN', 'ALL_FILES_COMPLETE', 'PIPELINE_COMPLETE'].includes(type)) {
          getSession(sessionId).then((s) => {
            setSession(s);
            if (s.status === 'failed' || s.status === 'complete') {
              setIsRunning(false);
            }
          }).catch(() => {});
        }
      },
      onError: () => {
        // Will reconnect on next user action
      },
    });
  }, []);

  const start = useCallback(async (goal) => {
    setError(null);
    setIsRunning(true);

    try {
      const { sessionId, session: newSession } = await startPipeline(goal);
      setSession(newSession);
      connectStream(sessionId);
      return sessionId;
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      setError(msg);
      setIsRunning(false);
      return null;
    }
  }, [connectStream]);

  const approve = useCallback(async (step) => {
    if (!session) return;
    setError(null);
    setIsRunning(true);

    try {
      const updated = await approveStep(session.sessionId, step);
      setSession(updated);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [session]);

  const reject = useCallback(async (step, reason) => {
    if (!session) return;
    setError(null);
    setIsRunning(true);

    try {
      const updated = await rejectStep(session.sessionId, step, reason);
      setSession(updated);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [session]);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const updated = await getSession(session.sessionId);
      setSession(updated);
    } catch {}
  }, [session]);

  return { session, isRunning, error, start, approve, reject, refresh };
};

export default useAgentPipeline;
