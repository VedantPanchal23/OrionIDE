/**
 * Orion IDE — Auth API Service
 *
 * Uses relative URLs. In dev, CRA proxy handles /api → gateway.
 * In production, nginx proxy handles /api → gateway.
 */

/**
 * Redirect to Google OAuth login.
 */
export const loginWithGoogle = () => {
  window.location.href = '/api/auth/google';
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
