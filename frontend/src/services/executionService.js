import api from './api';

export async function executeFile(language, fileName, code, stdin = '') {
  const res = await api.post('/execute', { language, fileName, code, stdin });
  return res.data?.data;
}

export async function getExecutionResult(executionId) {
  const res = await api.get(`/execute/${executionId}/result`);
  return res.data?.data;
}

export function getExecutionStreamUrl(executionId) {
  const token = sessionStorage.getItem('orion_access_token') || '';
  return `/api/execute/${executionId}/stream?token=${encodeURIComponent(token)}`;
}
