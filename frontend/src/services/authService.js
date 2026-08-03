/**
 * Orion IDE — Auth API Service
 *
 * Uses relative URLs. In dev, Vite proxy handles /api → gateway.
 * In production, reverse proxy handles /api → gateway.
 */

/**
 * Redirect to Google OAuth login.
 */
export const loginWithGoogle = () => {
  window.location.href = '/api/auth/google';
};

/**
 * Exchange a one-time OAuth handoff code for an access JWT.
 * @param {string} code
 * @returns {Promise<string>} accessToken
 */
export const exchangeAuthCode = async (code) => {
  const res = await fetch('/api/auth/exchange', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message || 'Auth code exchange failed';
    throw new Error(message);
  }

  const accessToken = body?.data?.accessToken;
  if (!accessToken) throw new Error('No access token returned');
  return accessToken;
};

/** In-flight / completed exchanges — survives React Strict Mode remounts */
const exchangeCache = new Map();

/**
 * Exchange a handoff code at most once per page load.
 * Concurrent/remount callers share the same promise so Redis single-use codes work.
 */
export const exchangeAuthCodeOnce = (code) => {
  if (!code) return Promise.reject(new Error('Auth code is required'));
  if (exchangeCache.has(code)) return exchangeCache.get(code);

  const promise = exchangeAuthCode(code)
    .then((token) => {
      try { sessionStorage.setItem('orion_access_token', token); } catch { /* ignore */ }
      return token;
    })
    .catch((err) => {
      // Allow a later manual retry after a real failure (not Strict Mode double-call)
      exchangeCache.delete(code);
      throw err;
    });

  exchangeCache.set(code, promise);
  return promise;
};

/**
 * Refresh access token via httpOnly cookie (set during OAuth callback).
 */
export const refreshAccessToken = async () => {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return body?.data?.accessToken || null;
};

/**
 * Logout: revoke refresh token and clear cookie.
 */
export const logout = async () => {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
};
