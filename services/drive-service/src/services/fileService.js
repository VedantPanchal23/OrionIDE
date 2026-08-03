/**
 * Orion IDE — File Service
 *
 * Google Drive file CRUD operations with retry on rate limits / 5xx.
 */

const { Readable } = require('stream');
const { getMimeType, MIME_TYPES } = require('./driveClient');
const { driveApi } = require('./driveApi');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('drive-service');

/** Google Docs Editors files cannot use alt=media — must export */
const GOOGLE_EXPORT_MAP = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
  'application/vnd.google-apps.drawing': 'image/png',
};

const createFile = async (driveClient, parentId, name, content = '', mimeType = null) => {
  const resolvedMimeType = mimeType || getMimeType(name);
  const body = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');

  const response = await driveApi(
    () => driveClient.files.create({
      requestBody: {
        name,
        parents: [parentId],
        mimeType: resolvedMimeType,
      },
      media: {
        mimeType: resolvedMimeType,
        body: Readable.from(body),
      },
      fields: 'id, name, mimeType, webViewLink, modifiedTime',
    }),
    'files.create'
  );

  logger.info('File created', { fileId: response.data.id, name, parentId });

  return {
    id: response.data.id,
    name: response.data.name,
    mimeType: response.data.mimeType || resolvedMimeType,
    isFolder: false,
    webViewLink: response.data.webViewLink || null,
    modifiedTime: response.data.modifiedTime,
  };
};

/**
 * Read file content. When options.asBinary, returns { content, encoding, size }.
 * Otherwise returns a utf8 string (legacy callers).
 * Google Docs Editors files are exported as text.
 */
const readFile = async (driveClient, fileId, options = {}) => {
  // Detect Google native mime via metadata first (cheap) when download would fail
  let metaMime = null;
  try {
    const meta = await driveApi(
      () => driveClient.files.get({ fileId, fields: 'mimeType, name' }),
      'files.metadata.forRead'
    );
    metaMime = meta.data?.mimeType || null;
  } catch { /* fall through to media */ }

  if (metaMime && metaMime.startsWith('application/vnd.google-apps.')) {
    if (metaMime === MIME_TYPES.FOLDER) {
      const err = new Error('Cannot read a folder as a file');
      err.code = 400;
      throw err;
    }
    const exportMime = GOOGLE_EXPORT_MAP[metaMime] || 'text/plain';
    const response = await driveApi(
      () => driveClient.files.export(
        { fileId, mimeType: exportMime },
        { responseType: options.asBinary ? 'arraybuffer' : 'text' }
      ),
      'files.export'
    );
    if (options.asBinary) {
      const buf = Buffer.from(response.data);
      return { content: buf.toString('base64'), encoding: 'base64', size: buf.length };
    }
    return typeof response.data === 'string'
      ? response.data
      : Buffer.from(response.data).toString('utf8');
  }

  if (options.asBinary) {
    const response = await driveApi(
      () => driveClient.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      ),
      'files.get.media.binary'
    );
    const buf = Buffer.from(response.data);
    return { content: buf.toString('base64'), encoding: 'base64', size: buf.length };
  }

  const response = await driveApi(
    () => driveClient.files.get(
      { fileId, alt: 'media' },
      { responseType: 'text' }
    ),
    'files.get.media'
  );

  return typeof response.data === 'string'
    ? response.data
    : JSON.stringify(response.data);
};

const updateFile = async (driveClient, fileId, content) => {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
  const response = await driveApi(
    () => driveClient.files.update({
      fileId,
      media: {
        mimeType: 'application/octet-stream',
        body: Readable.from(body),
      },
      fields: 'id, modifiedTime',
    }),
    'files.update'
  );

  logger.debug('File updated', { fileId, modifiedTime: response.data.modifiedTime });

  return {
    id: response.data.id,
    modifiedTime: response.data.modifiedTime,
  };
};

const deleteFile = async (driveClient, fileId) => {
  await driveApi(
    () => driveClient.files.update({
      fileId,
      requestBody: { trashed: true },
    }),
    'files.trash'
  );

  logger.info('File deleted (trashed)', { fileId });
  return { success: true };
};

const renameFile = async (driveClient, fileId, newName) => {
  const response = await driveApi(
    () => driveClient.files.update({
      fileId,
      requestBody: { name: newName },
      fields: 'id, name',
    }),
    'files.rename'
  );

  logger.info('File renamed', { fileId, newName });

  return {
    id: response.data.id,
    name: response.data.name,
  };
};

const getMetadata = async (driveClient, fileId) => {
  const response = await driveApi(
    () => driveClient.files.get({
      fileId,
      fields: 'id, name, mimeType, parents, modifiedTime, size, webViewLink, md5Checksum',
    }),
    'files.metadata'
  );

  return {
    id: response.data.id,
    name: response.data.name,
    mimeType: response.data.mimeType,
    parents: response.data.parents || [],
    modifiedTime: response.data.modifiedTime,
    size: response.data.size ? parseInt(response.data.size, 10) : null,
    webViewLink: response.data.webViewLink || null,
    md5Checksum: response.data.md5Checksum || null,
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
