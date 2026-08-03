/**
 * Orion IDE — Shared Axios API Instance
 *
 * Single axios instance for all frontend API calls.
 * - baseURL: relative '/api' — works with both dev proxy and nginx in production
 * - withCredentials: true — sends httpOnly cookies automatically
 * - Request interceptor: auth token attached by AuthContext (see AuthContext.jsx)
 * - Response interceptor: on 401, clears session and redirects to /login
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor: handle expired / invalid tokens globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      // Don't hard-redirect during OAuth handoff — AuthSuccess handles failures
      if (currentPath !== '/login' && currentPath !== '/auth/success') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
