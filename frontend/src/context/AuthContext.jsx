/**
 * Orion IDE — Auth Context
 *
 * Manages authentication state across the app.
 * - Stores token in memory (not localStorage)
 * - Attaches token to every axios request via interceptor
 * - On app load: calls POST /api/auth/refresh to restore session from cookie
 * - Exposes: token, user, loading, setToken, logout
 */

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const interceptorRef = useRef(null);

  /**
   * Set a new access token, fetch user info, and update state.
   */
  const setToken = useCallback(async (newToken) => {
    setTokenState(newToken);
    if (!newToken) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${newToken}` },
      });
      setUser(res.data.data || res.data);
    } catch {
      setTokenState(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Axios interceptor: attach token to every outgoing request.
   */
  useEffect(() => {
    if (interceptorRef.current !== null) {
      axios.interceptors.request.eject(interceptorRef.current);
    }
    interceptorRef.current = axios.interceptors.request.use((config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }, [token]);

  /**
   * On mount: try silent refresh using httpOnly cookie.
   */
  useEffect(() => {
    axios
      .post('/api/auth/refresh', {}, { withCredentials: true })
      .then((res) => {
        const t = res.data?.data?.accessToken || res.data?.accessToken;
        if (t) return setToken(t);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Logout: clear state + call API to revoke refresh token.
   */
  const logout = useCallback(async () => {
    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
    } catch {
      // Ignore — we clear local state regardless
    }
    setTokenState(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, loading, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
