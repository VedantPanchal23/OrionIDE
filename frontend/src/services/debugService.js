/**
 * Editor problems + debug API clients
 */

import api from './api';

export async function getProblems(projectId) {
  const res = await api.get('/editor/problems', { params: projectId ? { projectId } : undefined });
  return res.data?.data || res.data || { problems: [] };
}

export async function listDebugAdapters() {
  const res = await api.get('/editor/debug/adapters');
  return res.data?.data?.adapters || [];
}

export async function createDebugSession(config) {
  const res = await api.post('/editor/debug/sessions', config);
  return res.data?.data;
}

export async function debugCommand(sessionId, command, body = {}) {
  const res = await api.post(`/editor/debug/sessions/${sessionId}/command`, { command, ...body });
  return res.data?.data;
}

export async function setDebugBreakpoints(sessionId, breakpoints) {
  const res = await api.post(`/editor/debug/sessions/${sessionId}/breakpoints`, { breakpoints });
  return res.data?.data;
}

export async function getDebugStack(sessionId) {
  const res = await api.get(`/editor/debug/sessions/${sessionId}/stack`);
  return res.data?.data?.stackFrames || [];
}

export async function destroyDebugSession(sessionId) {
  await api.delete(`/editor/debug/sessions/${sessionId}`);
}

export const debugService = {
  listAdapters: listDebugAdapters,
  createSession: createDebugSession,
  command: debugCommand,
  setBreakpoints: setDebugBreakpoints,
  stack: getDebugStack,
  destroy: destroyDebugSession,
};

export const problemsService = { getProblems };
