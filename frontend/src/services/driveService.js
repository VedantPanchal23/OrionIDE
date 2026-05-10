/**
 * Orion IDE — Drive API Service (Frontend)
 *
 * All drive API calls use the shared api instance with relative paths.
 * Auth token is attached automatically via the axios interceptor in AuthContext.
 */

import api from './api';

/**
 * List user projects (top-level folders in OrionIDE/).
 */
export const listProjects = () =>
  api.get('/drive/projects');

/**
 * List files/folders in a folder.
 */
export const listFiles = (folderId) =>
  api.get('/drive/files', { params: { folderId } });

/**
 * Create a new file or folder.
 */
export const createFile = (parentFolderId, name, type = 'file') =>
  api.post('/drive/files', { parentFolderId, name, type });

/**
 * Read file content.
 */
export const readFile = (fileId) =>
  api.get(`/drive/files/${fileId}`);

/**
 * Update file content.
 */
export const updateFile = (fileId, content) =>
  api.put(`/drive/files/${fileId}`, { content });

/**
 * Delete a file or folder.
 */
export const deleteFile = (fileId) =>
  api.delete(`/drive/files/${fileId}`);

/**
 * Rename a file or folder.
 */
export const renameFile = (fileId, newName) =>
  api.patch(`/drive/files/${fileId}/rename`, { newName });

/**
 * Create a folder.
 */
export const createFolder = (parentFolderId, name) =>
  createFile(parentFolderId, name, 'folder');

/**
 * Flush (immediate save) file content.
 */
export const flushFile = (fileId, content) =>
  api.put(`/drive/files/${fileId}/flush`, { content });

export const driveService = {
  listProjects, listFiles, createFile, readFile,
  updateFile, deleteFile, renameFile, createFolder, flushFile,
};
