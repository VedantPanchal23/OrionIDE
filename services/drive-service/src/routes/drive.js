/**
 * Orion IDE — Drive Service Routes
 *
 * All routes extract the user's Google access token from headers set by the API Gateway.
 * The API Gateway validates the JWT and forwards user info as headers.
 *
 * Endpoints:
 *   GET    /drive/projects            — List all project folders in OrionIDE/
 *   GET    /drive/files               — List files in a folder (?folderId=)
 *   POST   /drive/files               — Create file or folder
 *   GET    /drive/files/:id           — Read file content
 *   PUT    /drive/files/:id           — Update (add to write buffer)
 *   PUT    /drive/files/:id/flush     — Immediate write to Drive (Ctrl+S)
 *   DELETE /drive/files/:id           — Delete file or folder
 *   PATCH  /drive/files/:id/rename    — Rename file or folder
 *   POST   /drive/ensure-root        — Ensure OrionIDE/ folder exists
 *   POST   /drive/ensure-path        — Ensure nested folder path exists
 */

const express = require('express');
const { createDriveClient, MIME_TYPES } = require('../services/driveClient');
const { ensureOrionFolder, listFolder, createFolder, deleteFolder, ensurePath } = require('../services/folderService');
const { createFile, readFile, updateFile, deleteFile, renameFile, getMetadata } = require('../services/fileService');
const { addToBuffer, flushImmediate } = require('../services/writeBuffer');
const { createLogger } = require('../../../../shared/utils/logger');
const { publishEvent } = require('../../../../shared/utils/notify');
const { EVENT_TYPES } = require('../../../../shared/constants/events');

const logger = createLogger('drive-service');
const router = express.Router();

const notifyDrive = (type, userId, payload) => {
  if (!userId) return;
  publishEvent({ type, userId, payload }).catch(() => {});
};

// ── Middleware: extract Google access token and user info ─────────────────
// Tokens only from gateway headers — never from request body (spoofable).
const extractUserContext = (req, res, next) => {
  const serviceSecret = process.env.DRIVE_SERVICE_SECRET || process.env.INTERNAL_SECRET;
  if (serviceSecret) {
    const provided = req.headers['x-internal-secret'] || req.headers['x-orion-service-secret'];
    if (provided !== serviceSecret) {
      return res.status(403).json({
        error: {
          code: 'DRIVE_FORBIDDEN',
          message: 'Missing or invalid service secret',
          details: null,
        },
      });
    }
  }

  req.userId = req.headers['x-user-id'];
  req.userEmail = req.headers['x-user-email'];
  req.googleAccessToken = req.headers['x-google-access-token'];

  if (!req.userId || !req.googleAccessToken) {
    return res.status(401).json({
      error: {
        code: 'DRIVE_NO_AUTH',
        message: 'Missing X-User-Id or X-Google-Access-Token header',
        details: null,
      },
    });
  }

  next();
};

router.use(extractUserContext);

// ── Helper: create Drive client from request context ──────────────────────
const getDriveFromReq = (req) => createDriveClient(req.googleAccessToken);


// ── Helper: standard success response ────────────────────────────────────
const success = (res, data, statusCode = 200) => {
  res.status(statusCode).json({
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
};

// ── Helper: standard error response ──────────────────────────────────────
const error = (res, code, message, statusCode = 500, details = null) => {
  res.status(statusCode).json({
    error: { code, message, details },
  });
};

// ─────────────────────────────────────────────────────────────────────────
// POST /drive/ensure-root — Ensure OrionIDE/ folder exists
// Called by auth-service after Google OAuth login
// ─────────────────────────────────────────────────────────────────────────
router.post('/ensure-root', async (req, res) => {
  try {
    const driveClient = getDriveFromReq(req);
    const folderId = await ensureOrionFolder(driveClient, req.userId);
    success(res, { folderId });
  } catch (err) {
    logger.error('ensure-root failed', { userId: req.userId, error: err.message });
    error(res, 'DRIVE_ERROR', 'Failed to ensure OrionIDE folder', 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /drive/projects — List all project folders inside OrionIDE/
// ─────────────────────────────────────────────────────────────────────────
router.get('/projects', async (req, res) => {
  try {
    const driveClient = getDriveFromReq(req);
    const rootFolderId = await ensureOrionFolder(driveClient, req.userId);
    const items = await listFolder(driveClient, rootFolderId);
    // Projects are top-level folders inside OrionIDE/
    const projects = items.filter((item) => item.isFolder);
    success(res, { projects, rootFolderId });
  } catch (err) {
    logger.error('list projects failed', { userId: req.userId, error: err.message });
    error(res, 'DRIVE_LIST_ERROR', 'Failed to list projects', 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /drive/files — List files in a folder
// Query: ?folderId=<id>
// ─────────────────────────────────────────────────────────────────────────
router.get('/files', async (req, res) => {
  try {
    const { folderId } = req.query;
    if (!folderId) {
      return error(res, 'DRIVE_MISSING_PARAM', 'folderId query parameter is required', 400);
    }

    const driveClient = getDriveFromReq(req);
    const items = await listFolder(driveClient, folderId);
    success(res, { files: items, folderId });
  } catch (err) {
    logger.error('list files failed', { userId: req.userId, error: err.message });
    error(res, 'DRIVE_LIST_ERROR', 'Failed to list files', 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /drive/files — Create a file or folder
// Body: { parentFolderId, name, type: 'file'|'folder', content? }
// ─────────────────────────────────────────────────────────────────────────
router.post('/files', async (req, res) => {
  try {
    const { parentFolderId, name, type, content } = req.body;

    if (!parentFolderId || !name) {
      return error(res, 'DRIVE_MISSING_PARAM', 'parentFolderId and name are required', 400);
    }

    const driveClient = getDriveFromReq(req);

    if (type === 'folder') {
      const existing = await listFolder(driveClient, parentFolderId);
      const clash = existing.find(
        (item) => item.isFolder && item.name.toLowerCase() === String(name).toLowerCase()
      );
      if (clash) {
        return error(res, 'DRIVE_NAME_EXISTS', `A folder named "${name}" already exists here`, 409);
      }
      const folder = await createFolder(driveClient, parentFolderId, name);
      notifyDrive(EVENT_TYPES.FOLDER_CREATED, req.userId, { folderId: folder.id, name, parentFolderId });
      return success(res, folder, 201);
    }

    // Default: create file — reject same-name siblings (Drive allows them; Orion does not)
    {
      const existing = await listFolder(driveClient, parentFolderId);
      const clash = existing.find(
        (item) => !item.isFolder && item.name.toLowerCase() === String(name).toLowerCase()
      );
      if (clash) {
        return error(res, 'DRIVE_NAME_EXISTS', `A file named "${name}" already exists here`, 409);
      }
    }
    let fileContent = content || '';
    if (req.body.encoding === 'base64' && typeof fileContent === 'string') {
      fileContent = Buffer.from(fileContent, 'base64');
    }
    const file = await createFile(driveClient, parentFolderId, name, fileContent);
    notifyDrive(EVENT_TYPES.FILE_CREATED, req.userId, { fileId: file.id, name, parentFolderId });
    success(res, file, 201);
  } catch (err) {
    logger.error('create file/folder failed', { userId: req.userId, error: err.message });
    error(res, 'DRIVE_CREATE_ERROR', 'Failed to create file/folder', 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Helper: extract file ID from wildcard params (supports IDs with slashes)
// ─────────────────────────────────────────────────────────────────────────
const extractFileId = (req) => {
  // req.params[0] captures everything after /files/
  return req.params[0] || req.params.id;
};

// ─────────────────────────────────────────────────────────────────────────
// GET /drive/files/* — Read file content
// Uses wildcard to support file IDs containing slashes (mock drive paths)
// ─────────────────────────────────────────────────────────────────────────
router.get('/files/*', async (req, res) => {
  try {
    const fileId = extractFileId(req);
    const driveClient = getDriveFromReq(req);
    const content = await readFile(driveClient, fileId);
    const metadata = await getMetadata(driveClient, fileId);
    success(res, { content, metadata });
  } catch (err) {
    if (err.code === 404) {
      return error(res, 'DRIVE_FILE_NOT_FOUND', 'File not found', 404);
    }
    if (err.code === 400) {
      return error(res, 'DRIVE_READ_ERROR', err.message || 'Cannot read this file', 400);
    }
    const msg = String(err.message || '');
    if (msg.includes('fileNotDownloadable') || msg.includes('Only files with binary content')) {
      return error(
        res,
        'DRIVE_NOT_EDITABLE',
        'This Google Docs/Sheets file cannot be opened as source code. Export it as plain text first, or open a .py/.js/.ts file instead.',
        422,
        msg
      );
    }
    logger.error('read file failed', { fileId: extractFileId(req), error: err.message });
    error(res, 'DRIVE_READ_ERROR', 'Failed to read file', 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /drive/files/*/flush — Immediate write to Drive (Ctrl+S)
// Body: { content }
// NOTE: Must be registered BEFORE the generic PUT /files/* route
// ─────────────────────────────────────────────────────────────────────────
router.put(/^\/files\/(.+)\/flush$/, async (req, res) => {
  try {
    const fileId = req.params[0];
    let { content, encoding } = req.body;

    if (content === undefined || content === null) {
      return error(res, 'DRIVE_MISSING_PARAM', 'content is required', 400);
    }

    if (encoding === 'base64' && typeof content === 'string') {
      content = Buffer.from(content, 'base64');
    }

    const result = await flushImmediate(req.userId, fileId, content, req.googleAccessToken);

    notifyDrive(EVENT_TYPES.FILE_SAVED, req.userId, { fileId, flushed: true });

    success(res, {
      fileId: result.id,
      modifiedTime: result.modifiedTime,
      flushed: true,
      message: 'Content written to Drive immediately',
    });
  } catch (err) {
    notifyDrive(EVENT_TYPES.FILE_SAVE_ERROR, req.userId, { fileId: req.params[0], message: err.message });
    logger.error('immediate flush failed', { fileId: req.params[0], error: err.message });
    error(res, 'DRIVE_FLUSH_ERROR', 'Failed to write to Drive', 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /drive/files/* — Update file content (add to write buffer)
// Body: { content }
// Does NOT write to Drive immediately — buffers in Redis for 60s batch flush.
// ─────────────────────────────────────────────────────────────────────────
router.put('/files/*', async (req, res) => {
  try {
    const fileId = extractFileId(req);
    const { content } = req.body;

    if (content === undefined || content === null) {
      return error(res, 'DRIVE_MISSING_PARAM', 'content is required', 400);
    }

    await addToBuffer(req.userId, fileId, content, req.googleAccessToken);

    notifyDrive(EVENT_TYPES.FILE_UPDATED, req.userId, { fileId, buffered: true });

    success(res, {
      fileId,
      buffered: true,
      message: 'Content buffered — will be written to Drive within 60 seconds',
    });
  } catch (err) {
    logger.error('buffer write failed', { fileId: extractFileId(req), error: err.message });
    error(res, 'DRIVE_BUFFER_ERROR', 'Failed to buffer content', 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PATCH /drive/files/*/rename — Rename file or folder
// Body: { newName }
// NOTE: Must be registered BEFORE the generic DELETE /files/* route
// ─────────────────────────────────────────────────────────────────────────
router.patch(/^\/files\/(.+)\/rename$/, async (req, res) => {
  try {
    const fileId = req.params[0];
    const { newName } = req.body;

    if (!newName) {
      return error(res, 'DRIVE_MISSING_PARAM', 'newName is required', 400);
    }

    const driveClient = getDriveFromReq(req);
    const result = await renameFile(driveClient, fileId, newName);
    notifyDrive(EVENT_TYPES.FILE_RENAMED, req.userId, { fileId, newName });
    success(res, result);
  } catch (err) {
    logger.error('rename failed', { fileId: req.params[0], error: err.message });
    error(res, 'DRIVE_RENAME_ERROR', 'Failed to rename', 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// DELETE /drive/files/* — Delete file or folder
// ─────────────────────────────────────────────────────────────────────────
router.delete('/files/*', async (req, res) => {
  try {
    const fileId = extractFileId(req);
    const driveClient = getDriveFromReq(req);

    // Check if it's a folder or file
    const metadata = await getMetadata(driveClient, fileId);

    if (metadata.mimeType === MIME_TYPES.FOLDER) {
      await deleteFolder(driveClient, fileId);
    } else {
      await deleteFile(driveClient, fileId);
    }

    notifyDrive(EVENT_TYPES.FILE_DELETED, req.userId, { fileId });
    success(res, { deleted: true, id: fileId });
  } catch (err) {
    if (err.code === 404) {
      return error(res, 'DRIVE_FILE_NOT_FOUND', 'File not found', 404);
    }
    logger.error('delete failed', { fileId: extractFileId(req), error: err.message });
    error(res, 'DRIVE_DELETE_ERROR', 'Failed to delete', 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /drive/ensure-path — Ensure nested folder path exists
// Body: { rootFolderId, path }
// ─────────────────────────────────────────────────────────────────────────
router.post('/ensure-path', async (req, res) => {
  try {
    const { rootFolderId, path } = req.body;

    if (!rootFolderId || !path) {
      return error(res, 'DRIVE_MISSING_PARAM', 'rootFolderId and path are required', 400);
    }

    const driveClient = getDriveFromReq(req);
    const folderId = await ensurePath(driveClient, rootFolderId, path);
    success(res, { folderId, path });
  } catch (err) {
    logger.error('ensure-path failed', { error: err.message });
    error(res, 'DRIVE_PATH_ERROR', 'Failed to ensure path', 500, err.message);
  }
});

module.exports = router;
