import axios from 'axios';
import { formatApiError, isPlanError } from '../utils/apiError';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let accessToken = null;
let refreshHandler = null;
let apiErrorHandler = null;

export function setAccessToken(token) {
  accessToken = token || null;
  if (token) sessionStorage.setItem('orion_access_token', token);
  else sessionStorage.removeItem('orion_access_token');
}

export function getAccessToken() {
  if (accessToken) return accessToken;
  const stored = sessionStorage.getItem('orion_access_token');
  if (stored) accessToken = stored;
  return accessToken;
}

export function setRefreshHandler(fn) {
  refreshHandler = fn;
}

export function setApiErrorHandler(fn) {
  apiErrorHandler = fn;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = null;

function isAuthRefreshRequest(config) {
  const url = String(config?.url || '');
  return url.includes('/auth/refresh') || url.includes('/auth/exchange');
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401
      && original
      && !original._retry
      && refreshHandler
      && !isAuthRefreshRequest(original)
    ) {
      original._retry = true;
      try {
        refreshing = refreshing || refreshHandler();
        const token = await refreshing;
        refreshing = null;
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      } catch {
        refreshing = null;
        setAccessToken(null);
      }
    }

    if (isPlanError(error) && apiErrorHandler && !original?._planNotified) {
      if (original) original._planNotified = true;
      try {
        apiErrorHandler(formatApiError(error));
      } catch { /* ignore */ }
    }

    return Promise.reject(error);
  },
);

export default api;
