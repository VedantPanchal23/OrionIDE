/**
 * Orion IDE — useNotifications Hook
 *
 * Connects to SSE on mount, disconnects on unmount.
 * Re-exports on/off for components to subscribe to specific events.
 * Uses AuthContext token instead of window.__ORION_ACCESS_TOKEN__.
 */

import { useState, useEffect, useCallback } from 'react';
import { connect, disconnect, on, off } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';

const useNotifications = () => {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const handleConnected = () => setConnected(true);
    on('connected', handleConnected);

    connect(token);

    return () => {
      off('connected', handleConnected);
      disconnect();
      setConnected(false);
    };
  }, [token]);

  const subscribe = useCallback((eventType, handler) => {
    on(eventType, handler);
    return () => off(eventType, handler);
  }, []);

  return { isConnected: connected, subscribe, on, off };
};

export default useNotifications;
