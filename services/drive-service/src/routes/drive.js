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

const logger = createLogger('drive-service');
const router = express.Router();

// ── Middleware: extract Google access token and user info ─────────────────
const extractUserContext = (req, res, next) => {
  // The API Gateway decodes the JWT and includes the googleAccessToken in
  // the user payload, which gets forwarded as a header.
  // In the JWT payload: { userId, email, googleAccessToken, ... }
  // The gateway sets: X-User-Id, X-User-Email
  // The googleAccessToken is in the Authorization header forwarded from the JWT
  
  req.userId = req.headers['x-user-id'];
  req.userEmail = req.headers['x-user-email'];

  // googleAccessToken comes from the request body for ensure-root (auth-service calls directly)
  // or from a custom header for authenticated requests
  req.googleAccessToken = req.headers['x-google-access-token'] || req.body?.googleAccessToken;

  if (!req.userId && !req.googleAccessToken) {
    return res.status(401).json({
      error: {
        code: 'DRIVE_NO_AUTH',
        message: 'Missing user context or Google access token',
        details: null,
      },
    });
  }

  next();
};

router.use(extractUserContext);

// ── Helper: create Drive client from request context ──────────────────────
const getDriveFromReq = (req) => {
  if (!req.googleAccessToken) {
    throw new Error('Google access token not available');
  }
  return createDriveClient(req.googleAccessToken);
};

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
      const folder = await createFolder(driveClient, parentFolderId, name);
      return success(res, folder, 201);
    }

    // Default: create file
    const file = await createFile(driveClient, parentFolderId, name, content || '');
    success(res, file, 201);
  } catch (err) {
    logger.error('create file/folder failed', { userId: req.userId, error: err.message });
    error(res, 'DRIVE_CREATE_ERROR', 'Failed to create file/folder', 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /drive/files/:id — Read file content
// ─────────────────────────────────────────────────────────────────────────
router.get('/files/:id', async (req, res) => {
  try {
    const driveClient = getDriveFromReq(req);
    const content = await readFile(driveClient, req.params.id);
    const metadata = await getMetadata(driveClient, req.params.id);
    success(res, { content, metadata });
  } catch (err) {
    if (err.code === 404) {
      return error(res, 'DRIVE_FILE_NOT_FOUND', 'File not found', 404);
    }
    logger.error('read file failed', { fileId: req.params.id, error: err.message });
    error(res, 'DRIVE_READ_ERROR', 'Failed to read file', 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /drive/files/:id — Update file content (add to write buffer)
// Body: { content }
// Does NOT write to Drive immediately — buffers in Redis for 60s batch flush.
// ─────────────────────────────────────────────────────────────────────────
router.put('/files/:id', async (req, res) => {
  try {
    const { content } = req.body;

    if (content === undefined || content === null) {
      return error(res, 'DRIVE_MISSING_PARAM', 'content is required', 400);
    }

    await addToBuffer(req.userId, req.params.id, content, req.googleAccessToken);

    success(res, {
      fileId: req.params.id,
      buffered: true,
      message: 'Content buffered — will be written to Drive within 60 seconds',
    });
  } catch (err) {
    logger.error('buffer write failed', { fileId: req.params.id, error: err.message });
    error(res, 'DRIVE_BUFFER_ERROR', 'Failed to buffer content', 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /drive/files/:id/flush — Immediate write to Drive (Ctrl+S)
// Body: { content }
// ─────────────────────────────────────────────────────────────────────────
router.put('/files/:id/flush', async (req, res) => {
  try {
    const { content } = req.body;

    if (content === undefined || content === null) {
      return error(res, 'DRIVE_MISSING_PARAM', 'content is required', 400);
    }

    const result = await flushImmediate(req.userId, req.params.id, content, req.googleAccessToken);

    success(res, {
      fileId: result.id,
      modifiedTime: result.modifiedTime,
      flushed: true,
      message: 'Content written to Drive immediately',
    });
  } catch (err) {
    logger.error('immediate flush failed', { fileId: req.params.id, error: err.message });
    error(res, 'DRIVE_FLUSH_ERROR', 'Failed to write to Drive', 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// DELETE /drive/files/:id — Delete file or folder
// ─────────────────────────────────────────────────────────────────────────
router.delete('/files/:id', async (req, res) => {
  try {
    const driveClient = getDriveFromReq(req);

    // Check if it's a folder or file
    const metadata = await getMetadata(driveClient, req.params.id);

    if (metadata.mimeType === MIME_TYPES.FOLDER) {
      await deleteFolder(driveClient, req.params.id);
    } else {
      await deleteFile(driveClient, req.params.id);
    }

    success(res, { deleted: true, id: req.params.id });
  } catch (err) {
    if (err.code === 404) {
      return error(res, 'DRIVE_FILE_NOT_FOUND', 'File not found', 404);
    }
    logger.error('delete failed', { fileId: req.params.id, error: err.message });
    error(res, 'DRIVE_DELETE_ERROR', 'Failed to delete', 500, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PATCH /drive/files/:id/rename — Rename file or folder
// Body: { newName }
// ─────────────────────────────────────────────────────────────────────────
router.patch('/files/:id/rename', async (req, res) => {
  try {
    const { newName } = req.body;

    if (!newName) {
      return error(res, 'DRIVE_MISSING_PARAM', 'newName is required', 400);
    }

    const driveClient = getDriveFromReq(req);
    const result = await renameFile(driveClient, req.params.id, newName);
    success(res, result);
  } catch (err) {
    logger.error('rename failed', { fileId: req.params.id, error: err.message });
    error(res, 'DRIVE_RENAME_ERROR', 'Failed to rename', 500, err.message);
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
