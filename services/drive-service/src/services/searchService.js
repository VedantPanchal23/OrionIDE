/**
 * Orion IDE — Drive content / name search within a folder tree
 */

const { driveApi } = require('./driveApi');
const { MIME_TYPES } = require('./driveClient');

const escapeQuery = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/**
 * Search files under folderId (recursive BFS, limited depth/width).
 * Uses Drive fullText + name contains queries.
 *
 * @returns {Promise<{ files: Array<{id,name,mimeType,parents,isFolder}>, truncated: boolean }>}
 */
async function searchInProject(driveClient, folderId, query, options = {}) {
  const q = String(query || '').trim();
  if (!q || !folderId) return { files: [], truncated: false };

  const maxFolders = options.maxFolders || 40;
  const maxResults = options.maxResults || 50;
  const escaped = escapeQuery(q);
  const seen = new Set();
  const out = [];
  let truncated = false;

  const folderQueue = [folderId];
  let foldersVisited = 0;

  while (folderQueue.length && foldersVisited < maxFolders && out.length < maxResults) {
    const current = folderQueue.shift();
    foldersVisited += 1;

    // Name matches (files + folders) in this folder
    const nameRes = await driveApi(
      () => driveClient.files.list({
        q: `'${current}' in parents and trashed = false and name contains '${escaped}'`,
        fields: 'files(id, name, mimeType, parents)',
        pageSize: 50,
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      }),
      'search.name',
    );

    // Content matches (files only) in this folder
    const textRes = await driveApi(
      () => driveClient.files.list({
        q: `'${current}' in parents and trashed = false and mimeType != '${MIME_TYPES.FOLDER}' and fullText contains '${escaped}'`,
        fields: 'files(id, name, mimeType, parents)',
        pageSize: 50,
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      }),
      'search.fullText',
    );

    // Children folders for recursion
    const childFolders = await driveApi(
      () => driveClient.files.list({
        q: `'${current}' in parents and trashed = false and mimeType = '${MIME_TYPES.FOLDER}'`,
        fields: 'files(id, name, mimeType, parents)',
        pageSize: 100,
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      }),
      'search.childFolders',
    );

    const merge = [
      ...(nameRes.data.files || []),
      ...(textRes.data.files || []),
    ];

    for (const f of merge) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      out.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        parents: f.parents || [],
        isFolder: f.mimeType === MIME_TYPES.FOLDER,
        parentId: current,
      });
      if (out.length >= maxResults) {
        truncated = true;
        break;
      }
    }

    for (const f of childFolders.data.files || []) {
      folderQueue.push(f.id);
    }
  }

  if (folderQueue.length) truncated = true;
  return { files: out, truncated, query: q, folderId };
}

module.exports = { searchInProject, escapeQuery };
