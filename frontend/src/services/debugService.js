import api from './api';

export const listAdapters = () => api.get('/editor/debug/adapters');

export const listSessions = () => api.get('/editor/debug/sessions');

export const createSession = (config) =>
  api.post('/editor/debug/sessions', config);

export const getSession = (sessionId) =>
  api.get(`/editor/debug/sessions/${sessionId}`);

export const setBreakpoints = (sessionId, breakpoints) =>
  api.post(`/editor/debug/sessions/${sessionId}/breakpoints`, { breakpoints });

export const sendCommand = (sessionId, command, extra = {}) =>
  api.post(`/editor/debug/sessions/${sessionId}/command`, { command, ...extra });

export const getStack = (sessionId) =>
  api.get(`/editor/debug/sessions/${sessionId}/stack`);

export const getVariables = (sessionId, variablesReference = 1) =>
  api.get(`/editor/debug/sessions/${sessionId}/variables`, {
    params: { variablesReference },
  });

export const destroySession = (sessionId) =>
  api.delete(`/editor/debug/sessions/${sessionId}`);
