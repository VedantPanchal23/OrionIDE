import api, { setAccessToken } from './api';

export function startGoogleLogin() {
  window.location.href = '/api/auth/google';
}

export async function exchangeAuthCode(code) {
  const res = await api.post('/auth/exchange', { code });
  const token = res.data?.data?.accessToken;
  if (token) setAccessToken(token);
  return res.data?.data;
}

export async function refreshAccessToken() {
  const res = await api.post('/auth/refresh');
  const token = res.data?.data?.accessToken;
  if (token) setAccessToken(token);
  return token || null;
}

export async function fetchMe() {
  const res = await api.get('/auth/me');
  return res.data?.data || null;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}
