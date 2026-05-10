/**
 * Orion IDE — Editor Session API Service
 * Uses shared api instance. Auth token attached via AuthContext interceptor.
 */

import api from './api';

export const editorService = {
  openFile: (fileId, fileName, language) =>
    api.post('/editor/session/open', { fileId, fileName, language }),

  closeFile: (fileId) =>
    api.delete(`/editor/session/close/${fileId}`),

  getSession: () =>
    api.get('/editor/session/state'),

  setActiveFile: (fileId) =>
    api.patch('/editor/session/active', { fileId }),

  markDirty: (fileId, isDirty) =>
    api.patch('/editor/session/dirty', { fileId, isDirty }),
};
