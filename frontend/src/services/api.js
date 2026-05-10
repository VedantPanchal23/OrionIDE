/**
 * Orion IDE — Shared Axios API Instance
 *
 * Single axios instance for all frontend API calls.
 * - baseURL: relative '/api' — works with both dev proxy and nginx in production
 * - withCredentials: true — sends httpOnly cookies automatically
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export default api;
