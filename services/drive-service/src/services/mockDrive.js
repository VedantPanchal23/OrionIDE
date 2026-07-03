/**
 * Orion IDE — Offline Local Filesystem Mock Google Drive Client
 *
 * Simulates the Google Drive v3 API by mapping operations directly to a real
 * folder structure inside the container (services/drive-service/src/mock-workspace).
 *
 * Enables real-time synchronization between PTY terminal file creations and the IDE file explorer.
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = path.join(__dirname, '..', 'mock-workspace');

// Helper to ensure workspace root exists
const ensureWorkspaceDir = () => {
  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  }
};

// Helper to convert fileId to absolute path
const idToPath = (fileId) => {
  ensureWorkspaceDir();
  if (!fileId || fileId === 'mock-root-folder' || fileId === 'root') {
    return WORKSPACE_DIR;
  }
  // Sanitize path to prevent directory traversal
  const safeId = fileId.replace(/^(\.\.(\/|\\|$))+/, '');
  return path.join(WORKSPACE_DIR, safeId);
};

// Helper to convert absolute path to fileId (relative to workspace root)
const pathToId = (absPath) => {
  const rel = path.relative(WORKSPACE_DIR, absPath);
  if (!rel || rel === '.' || rel === '') return 'mock-root-folder';
  return rel.replace(/\\/g, '/'); // Use forward slashes for IDs
};

// Helper to read content stream into string
const streamToString = async (stream) => {
  if (!stream) return '';
  if (typeof stream === 'string') return stream;
  if (Buffer.isBuffer(stream)) return stream.toString();
  
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
};

/**
 * Creates a mock Google Drive client mapped to the actual disk.
 */
const createMockDriveClient = () => {
  ensureWorkspaceDir();

  return {
    files: {
      list: async (params) => {
        const { q } = params || {};
        ensureWorkspaceDir();

        // 1. Handle ensureOrionFolder root check
        if (q && q.includes("name = 'OrionIDE'") && q.includes("'root' in parents")) {
          return {
            data: {
              files: [{
                id: 'mock-root-folder',
                name: 'OrionIDE',
                mimeType: 'application/vnd.google-apps.folder',
                parents: ['root'],
                modifiedTime: new Date().toISOString(),
                trashed: false
              }]
            }
          };
        }

        // 2. Handle listFolder: '<folderId>' in parents
        const parentMatch = q ? q.match(/'([^']+)' in parents/) : null;
        if (parentMatch) {
          const folderId = parentMatch[1];
          const folderPath = idToPath(folderId);

          if (!fs.existsSync(folderPath)) {
            return { data: { files: [] } };
          }

          const entries = fs.readdirSync(folderPath, { withFileTypes: true });
          const files = entries
            .filter(entry => {
              // Ignore hidden files and node_modules to keep IDE clean/fast
              return !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist';
            })
            .map(entry => {
              const entryPath = path.join(folderPath, entry.name);
              const stat = fs.statSync(entryPath);
              const id = pathToId(entryPath);
              return {
                id,
                name: entry.name,
                mimeType: entry.isDirectory() ? 'application/vnd.google-apps.folder' : 'text/plain',
                parents: [folderId],
                modifiedTime: stat.mtime.toISOString(),
                size: entry.isDirectory() ? undefined : stat.size,
                trashed: false
              };
            });

          return { data: { files } };
        }

        // 3. Handle ensurePath checks: name = 'xxx' and 'parent' in parents
        const nameMatch = q ? q.match(/name\s*=\s*'([^']+)'/) : null;
        if (nameMatch && parentMatch) {
          const name = nameMatch[1];
          const parentId = parentMatch[1];
          const folderPath = idToPath(parentId);
          const targetPath = path.join(folderPath, name);

          if (fs.existsSync(targetPath)) {
            const stat = fs.statSync(targetPath);
            return {
              data: {
                files: [{
                  id: pathToId(targetPath),
                  name,
                  mimeType: stat.isDirectory() ? 'application/vnd.google-apps.folder' : 'text/plain',
                  parents: [parentId],
                  modifiedTime: stat.mtime.toISOString(),
                  trashed: false
                }]
              }
            };
          }
        }

        return { data: { files: [] } };
      },

      create: async (params) => {
        const { requestBody, media } = params || {};
        ensureWorkspaceDir();

        const name = requestBody.name || 'Untitled';
        const parents = requestBody.parents || [];
        const parentId = parents[0] || 'mock-root-folder';
        const parentPath = idToPath(parentId);
        const targetPath = path.join(parentPath, name);
        const id = pathToId(targetPath);

        const isFolder = requestBody.mimeType === 'application/vnd.google-apps.folder';

        if (isFolder) {
          if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
          }
        } else {
          let content = '';
          if (media && media.body) {
            content = await streamToString(media.body);
          }
          fs.writeFileSync(targetPath, content, 'utf8');
        }

        const stat = fs.existsSync(targetPath) ? fs.statSync(targetPath) : { mtime: new Date() };

        return {
          data: {
            id,
            name,
            mimeType: requestBody.mimeType || 'text/plain',
            parents: [parentId],
            modifiedTime: stat.mtime.toISOString(),
            size: isFolder ? undefined : Buffer.byteLength(content || '')
          }
        };
      },

      get: async (params) => {
        const { fileId, alt } = params || {};
        ensureWorkspaceDir();

        const filePath = idToPath(fileId);

        if (!fs.existsSync(filePath)) {
          const err = new Error(`File not found: ${fileId}`);
          err.code = 404;
          throw err;
        }

        if (alt === 'media') {
          const content = fs.readFileSync(filePath, 'utf8');
          return { data: content };
        }

        const stat = fs.statSync(filePath);
        return {
          data: {
            id: fileId,
            name: path.basename(filePath),
            mimeType: stat.isDirectory() ? 'application/vnd.google-apps.folder' : 'text/plain',
            parents: [],
            modifiedTime: stat.mtime.toISOString(),
            size: stat.isDirectory() ? undefined : stat.size,
            trashed: false
          }
        };
      },

      update: async (params) => {
        const { fileId, requestBody, media } = params || {};
        ensureWorkspaceDir();

        const filePath = idToPath(fileId);

        if (!fs.existsSync(filePath)) {
          const err = new Error(`File not found for update: ${fileId}`);
          err.code = 404;
          throw err;
        }

        let currentPath = filePath;
        let newId = fileId;

        if (requestBody) {
          // Handle rename
          if (requestBody.name) {
            const parentDir = path.dirname(filePath);
            const newPath = path.join(parentDir, requestBody.name);
            fs.renameSync(filePath, newPath);
            currentPath = newPath;
            newId = pathToId(newPath);
          }
          // Handle trash
          if (requestBody.trashed === true) {
            if (fs.statSync(currentPath).isDirectory()) {
              fs.rmSync(currentPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(currentPath);
            }
            return { data: { id: fileId, trashed: true } };
          }
        }

        if (media && media.body) {
          const content = await streamToString(media.body);
          fs.writeFileSync(currentPath, content, 'utf8');
        }

        const stat = fs.existsSync(currentPath) ? fs.statSync(currentPath) : { mtime: new Date() };

        return {
          data: {
            id: newId,
            name: path.basename(currentPath),
            mimeType: stat.isDirectory() ? 'application/vnd.google-apps.folder' : 'text/plain',
            modifiedTime: stat.mtime.toISOString(),
            size: stat.isDirectory() ? undefined : stat.size,
            trashed: false
          }
        };
      }
    }
  };
};

module.exports = { createMockDriveClient };
