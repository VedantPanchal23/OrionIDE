/**
 * Orion IDE — File Service
 *
 * Google Drive file CRUD operations.
 * All functions take an authenticated driveClient as the first argument.
 */

const { Readable } = require('stream');
const { getMimeType } = require('./driveClient');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('drive-service');

/**
 * Create a new file in Google Drive.
 *
 * @param {import('googleapis').drive_v3.Drive} driveClient
 * @param {string} parentId — parent folder ID
 * @param {string} name — file name
 * @param {string} content — file content (string)
 * @param {string} [mimeType] — MIME type (auto-detected from name if omitted)
 * @returns {Promise<{ id: string, name: string, webViewLink: string }>}
 */
const createFile = async (driveClient, parentId, name, content = '', mimeType = null) => {
  const resolvedMimeType = mimeType || getMimeType(name);

  const response = await driveClient.files.create({
    requestBody: {
      name,
      parents: [parentId],
      mimeType: resolvedMimeType,
    },
    media: {
      mimeType: resolvedMimeType,
      body: Readable.from([content]),
    },
    fields: 'id, name, webViewLink, modifiedTime',
  });

  logger.info('File created', { fileId: response.data.id, name, parentId });

  return {
    id: response.data.id,
    name: response.data.name,
    webViewLink: response.data.webViewLink || null,
    modifiedTime: response.data.modifiedTime,
  };
};

/**
 * Read file content from Google Drive.
 *
 * @param {import('googleapis').drive_v3.Drive} driveClient
 * @param {string} fileId
 * @returns {Promise<string>} file content as string
 */
const readFile = async (driveClient, fileId) => {
  const response = await driveClient.files.get(
    { fileId, alt: 'media' },
    { responseType: 'text' }
  );

  return typeof response.data === 'string'
    ? response.data
    : JSON.stringify(response.data);
};

/**
 * Update file content in Google Drive.
 *
 * @param {import('googleapis').drive_v3.Drive} driveClient
 * @param {string} fileId
 * @param {string} content — new file content
 * @returns {Promise<{ id: string, modifiedTime: string }>}
 */
const updateFile = async (driveClient, fileId, content) => {
  const response = await driveClient.files.update({
    fileId,
    media: {
      mimeType: 'text/plain',
      body: Readable.from([content]),
    },
    fields: 'id, modifiedTime',
  });

  logger.debug('File updated', { fileId, modifiedTime: response.data.modifiedTime });

  return {
    id: response.data.id,
    modifiedTime: response.data.modifiedTime,
  };
};

/**
 * Delete (trash) a file in Google Drive.
 *
 * @param {import('googleapis').drive_v3.Drive} driveClient
 * @param {string} fileId
 * @returns {Promise<{ success: boolean }>}
 */
const deleteFile = async (driveClient, fileId) => {
  await driveClient.files.update({
    fileId,
    requestBody: { trashed: true },
  });

  logger.info('File deleted (trashed)', { fileId });
  return { success: true };
};

/**
 * Rename a file in Google Drive.
 *
 * @param {import('googleapis').drive_v3.Drive} driveClient
 * @param {string} fileId
 * @param {string} newName
 * @returns {Promise<{ id: string, name: string }>}
 */
const renameFile = async (driveClient, fileId, newName) => {
  const response = await driveClient.files.update({
    fileId,
    requestBody: { name: newName },
    fields: 'id, name',
  });

  logger.info('File renamed', { fileId, newName });

  return {
    id: response.data.id,
    name: response.data.name,
  };
};

/**
 * Get file metadata from Google Drive.
 *
 * @param {import('googleapis').drive_v3.Drive} driveClient
 * @param {string} fileId
 * @returns {Promise<{ id, name, mimeType, parents, modifiedTime, size }>}
 */
const getMetadata = async (driveClient, fileId) => {
  const response = await driveClient.files.get({
    fileId,
    fields: 'id, name, mimeType, parents, modifiedTime, size, webViewLink',
  });

  return {
    id: response.data.id,
    name: response.data.name,
    mimeType: response.data.mimeType,
    parents: response.data.parents || [],
    modifiedTime: response.data.modifiedTime,
    size: response.data.size ? parseInt(response.data.size, 10) : null,
    webViewLink: response.data.webViewLink || null,
  };
};

module.exports = {
  createFile,
  readFile,
  updateFile,
  deleteFile,
  renameFile,
  getMetadata,
};
