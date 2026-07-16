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
      // Token expired or invalid — redirect to login
      // Use location.replace so there's no back-button loop
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
