import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import {
  exchangeAuthCode, fetchMe, logout as apiLogout, refreshAccessToken,
} from '../services/authService';
import { getAccessToken, setAccessToken, setRefreshHandler } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
    return me;
  }, []);

  useEffect(() => {
    setRefreshHandler(async () => {
      const token = await refreshAccessToken();
      if (!token) {
        setUser(null);
        setAccessToken(null);
      }
      return token;
    });

    (async () => {
      try {
        let token = getAccessToken();
        if (!token) {
          token = await refreshAccessToken();
        }
        if (token) {
          await refreshMe();
        }
      } catch {
        setUser(null);
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshMe]);

  const completeLogin = useCallback(async (code) => {
    await exchangeAuthCode(code);
    return refreshMe();
  }, [refreshMe]);

  const completeLoginWithToken = useCallback(async (token) => {
    if (!token || typeof token !== 'string') {
      throw new Error('Missing access token');
    }
    setAccessToken(token.trim());
    return refreshMe();
  }, [refreshMe]);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    completeLogin,
    completeLoginWithToken,
    logout,
    refreshMe,
  }), [user, loading, completeLogin, completeLoginWithToken, logout, refreshMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
