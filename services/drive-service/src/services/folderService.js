/**
 * Orion IDE — Folder Service
 *
 * Google Drive folder operations for the OrionIDE workspace.
 *
 * Key functions:
 *   - ensureOrionFolder: finds or creates the OrionIDE/ root folder
 *   - listFolder: lists contents of a folder
 *   - createFolder: creates a new folder
 *   - deleteFolder: deletes a folder (items inside it stay — Drive has no cascade)
 *   - ensurePath: creates nested folder structures like 'src/components/'
 */

const { MIME_TYPES } = require('./driveClient');
const { getRedisClient } = require('./redisClient');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('drive-service');

const ROOT_FOLDER_NAME = 'OrionIDE';
const ROOT_FOLDER_CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

/**
 * Ensure the OrionIDE/ root folder exists in the user's Drive.
 * Checks Redis cache first, then searches Drive, then creates if missing.
 *
 * @param {import('googleapis').drive_v3.Drive} driveClient
 * @param {string} userId
 * @returns {Promise<string>} folderId of OrionIDE/ folder
 */
const ensureOrionFolder = async (driveClient, userId) => {
  const cacheKey = `drive:${userId}:rootFolderId`;

  // 1. Check Redis cache
  try {
    const redis = await getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug('Root folder ID from cache', { userId, folderId: cached });
      return cached;
    }
  } catch (err) {
    logger.warn('Redis cache miss (non-fatal)', { error: err.message });
  }

  // 2. Search Drive for existing OrionIDE/ folder
  const searchResponse = await driveClient.files.list({
    q: `name = '${ROOT_FOLDER_NAME}' and mimeType = '${MIME_TYPES.FOLDER}' and 'root' in parents and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  let folderId;

  if (searchResponse.data.files && searchResponse.data.files.length > 0) {
    folderId = searchResponse.data.files[0].id;
    logger.info('Found existing OrionIDE folder', { userId, folderId });
  } else {
    // 3. Create new OrionIDE/ folder
    const createResponse = await driveClient.files.create({
      requestBody: {
        name: ROOT_FOLDER_NAME,
        mimeType: MIME_TYPES.FOLDER,
        parents: ['root'],
      },
      fields: 'id, name',
    });

    folderId = createResponse.data.id;
    logger.info('Created OrionIDE folder', { userId, folderId });
  }

  // 4. Cache in Redis
  try {
    const redis = await getRedisClient();
    await redis.set(cacheKey, folderId, { EX: ROOT_FOLDER_CACHE_TTL });
  } catch (err) {
    logger.warn('Failed to cache root folder ID (non-fatal)', { error: err.message });
  }

  return folderId;
};

/**
 * List all items (files + folders) in a folder.
 *
 * @param {import('googleapis').drive_v3.Drive} driveClient
 * @param {string} folderId
 * @returns {Promise<Array>} Array of { id, name, mimeType, modifiedTime, size, parents }
 */
const listFolder = async (driveClient, folderId) => {
  const response = await driveClient.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime, size, parents)',
    orderBy: 'folder,name',
    pageSize: 1000,
    spaces: 'drive',
  });

  return (response.data.files || []).map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    isFolder: file.mimeType === MIME_TYPES.FOLDER,
    modifiedTime: file.modifiedTime,
    size: file.size ? parseInt(file.size, 10) : null,
    parents: file.parents || [],
  }));
};

/**
 * Create a new folder.
 *
 * @param {import('googleapis').drive_v3.Drive} driveClient
 * @param {string} parentId — parent folder ID
 * @param {string} name — folder name
 * @returns {Promise<{ id: string, name: string }>}
 */
const createFolder = async (driveClient, parentId, name) => {
  const response = await driveClient.files.create({
    requestBody: {
      name,
      mimeType: MIME_TYPES.FOLDER,
      parents: [parentId],
    },
    fields: 'id, name',
  });

  logger.info('Folder created', { folderId: response.data.id, name, parentId });

  return {
    id: response.data.id,
    name: response.data.name,
  };
};

/**
 * Delete a folder.
 * Note: Google Drive API trash does not cascade to children by default.
 * We trash the folder — items inside become orphans (still accessible via search).
 *
 * @param {import('googleapis').drive_v3.Drive} driveClient
 * @param {string} folderId
 * @returns {Promise<{ success: boolean }>}
 */
const deleteFolder = async (driveClient, folderId) => {
  await driveClient.files.update({
    fileId: folderId,
    requestBody: { trashed: true },
  });

  logger.info('Folder deleted (trashed)', { folderId });
  return { success: true };
};

/**
 * Ensure an entire path of nested folders exists.
 * Creates any missing folders in the path.
 *
 * Example: ensurePath(driveClient, rootId, 'src/components/ui')
 *   → ensures src/ exists → components/ exists → ui/ exists
 *   → returns folderId of ui/
 *
 * @param {import('googleapis').drive_v3.Drive} driveClient
 * @param {string} rootFolderId — starting parent folder ID
 * @param {string} pathString — forward-slash separated path ('src/components/ui')
 * @returns {Promise<string>} folderId of the deepest folder
 */
const ensurePath = async (driveClient, rootFolderId, pathString) => {
  if (!pathString || pathString === '/' || pathString === '.') {
    return rootFolderId;
  }

  // Split path into segments, filtering empty strings
  const segments = pathString.split('/').filter((s) => s.length > 0);
  let currentParentId = rootFolderId;

  for (const folderName of segments) {
    // Search for existing folder at this level
    const searchResponse = await driveClient.files.list({
      q: `name = '${folderName}' and mimeType = '${MIME_TYPES.FOLDER}' and '${currentParentId}' in parents and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      // Folder exists — move into it
      currentParentId = searchResponse.data.files[0].id;
    } else {
      // Folder doesn't exist — create it
      const created = await createFolder(driveClient, currentParentId, folderName);
      currentParentId = created.id;
    }
  }

  logger.debug('Path ensured', { rootFolderId, path: pathString, finalFolderId: currentParentId });
  return currentParentId;
};

module.exports = {
  ensureOrionFolder,
  listFolder,
  createFolder,
  deleteFolder,
  ensurePath,
  ROOT_FOLDER_NAME,
};
