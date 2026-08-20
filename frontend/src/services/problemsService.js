import api from './api';

export const getProblems = (projectId) =>
  api.get('/editor/problems', { params: { projectId } });

export const setFileProblems = (fileId, { projectId, filePath, diagnostics }) =>
  api.put(`/editor/problems/${fileId}`, { projectId, filePath, diagnostics });

export const setProblems = (projectId, files) =>
  api.put('/editor/problems', { projectId, files });

export const clearProblems = (projectId) =>
  api.delete('/editor/problems', { params: { projectId } });
