/**
 * Orion IDE — Auth context
 *
 * Bootstraps a session from sessionStorage token, falling back to the
 * httpOnly refresh cookie. Attaches the Bearer token to every axios
 * request via an interceptor, and connects the notification SSE stream
 * once a user is present.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import api from '../services/api';
import { refreshAccessToken, logout as apiLogout } from '../services/authService';
import * as notificationService from '../services/notificationService';

const AuthContext = createContext(null);
const TOKEN_KEY = 'orion_access_token';

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => {
    try { return sessionStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
  });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef(token);

  const setToken = useCallback((next) => {
    tokenRef.current = next;
    setTokenState(next);
    try {
      if (next) sessionStorage.setItem(TOKEN_KEY, next);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch { /* ignore */ }
  }, []);

  // Attach Authorization header to every outgoing request.
  useEffect(() => {
    const id = api.interceptors.request.use((config) => {
      const t = tokenRef.current;
      if (t) config.headers.Authorization = `Bearer ${t}`;
      return config;
    });
    return () => api.interceptors.request.eject(id);
  }, []);

  const fetchMe = useCallback(async () => {
    const res = await api.get('/auth/me');
    return res.data?.data || null;
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* ignore */ }
    notificationService.disconnect();
    setUser(null);
    setToken(null);
  }, [setToken]);

  // Bootstrap: sessionStorage token → validate; else refresh cookie → new token.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let activeToken = tokenRef.current;

      if (activeToken) {
        try {
          const me = await fetchMe();
          if (!cancelled) {
            setUser(me);
            setLoading(false);
          }
          return;
        } catch {
          // fall through to refresh
        }
      }

      try {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          activeToken = refreshed;
          setToken(refreshed);
          const me = await fetchMe();
          if (!cancelled) setUser(me);
        } else if (!cancelled) {
          setUser(null);
          setToken(null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect the notification stream whenever we have both a user and token.
  useEffect(() => {
    if (user && token) {
      notificationService.connect(token);
    } else {
      notificationService.disconnect();
    }
    return () => notificationService.disconnect();
  }, [user, token]);

  const value = useMemo(() => ({
    token,
    user,
    loading,
    setToken,
    setUser,
    logout,
    refreshMe: async () => {
      const me = await fetchMe();
      setUser(me);
      return me;
    },
  }), [token, user, loading, setToken, logout, fetchMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook is colocated with its provider
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
