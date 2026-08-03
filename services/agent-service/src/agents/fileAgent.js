/**
 * Orion IDE — File Agent
 *
 * Writes generated files to Google Drive via the drive-service.
 * No LLM — pure service-to-service calls.
 */

const BaseAgent = require('./baseAgent');
const axios = require('axios');
const { createLogger } = require('../../../../shared/utils/logger');
const { withRetry } = require('../../../../shared/utils/retry');

const logger = createLogger('agent-service');

const DRIVE_SERVICE_URL = process.env.DRIVE_SERVICE_URL || 'http://drive-service:3002';
const SERVICE_SECRET =
  process.env.INTERNAL_SECRET || process.env.DRIVE_SERVICE_SECRET || '';

class FileAgent extends BaseAgent {
  constructor() {
    super('FileAgent', null, null);
  }

  getSystemPrompt() {
    return null; // No LLM
  }

  /**
   * Headers for drive-service (gateway secret + user Google token).
   */
  driveHeaders(userId, googleAccessToken) {
    const headers = {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    };
    if (googleAccessToken) {
      headers['X-Google-Access-Token'] = googleAccessToken;
    }
    if (SERVICE_SECRET) {
      headers['X-Internal-Secret'] = SERVICE_SECRET;
      headers['X-Orion-Service-Secret'] = SERVICE_SECRET;
    }
    return headers;
  }

  async drivePost(path, body, headers) {
    return withRetry(async () => {
      try {
        return await axios.post(`${DRIVE_SERVICE_URL}${path}`, body, {
          headers,
          timeout: 20000,
        });
      } catch (err) {
        const status = err.response?.status;
        const normalized = new Error(err.response?.data?.error?.message || err.message);
        normalized.status = status;
        normalized.code = err.response?.data?.error?.code || err.code;
        throw normalized;
      }
    }, { retries: 3, baseMs: 500 });
  }

  async driveGet(path, headers) {
    return withRetry(async () => {
      try {
        return await axios.get(`${DRIVE_SERVICE_URL}${path}`, {
          headers,
          timeout: 20000,
        });
      } catch (err) {
        const status = err.response?.status;
        const normalized = new Error(err.response?.data?.error?.message || err.message);
        normalized.status = status;
        normalized.code = err.response?.data?.error?.code || err.code;
        throw normalized;
      }
    }, { retries: 3, baseMs: 500 });
  }

  /**
   * Ensure OrionIDE root + project folder exist; return project folder ID.
   */
  async ensureProjectFolder(userId, projectName, googleAccessToken) {
    if (!googleAccessToken) {
      throw Object.assign(new Error('Google access token required to create project folder'), {
        code: 'DRIVE_TOKEN_REQUIRED',
      });
    }

    const headers = this.driveHeaders(userId, googleAccessToken);
    const name = (projectName || 'Untitled Project').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 120)
      || 'Untitled Project';

    const rootRes = await this.drivePost('/drive/ensure-root', {}, headers);
    const rootFolderId = rootRes.data?.data?.folderId;
    if (!rootFolderId) {
      throw Object.assign(new Error('Failed to resolve OrionIDE root folder'), {
        code: 'DRIVE_ROOT_MISSING',
      });
    }

    try {
      const listRes = await this.driveGet('/drive/projects', headers);
      const existing = (listRes.data?.data?.projects || []).find(
        (p) => p.name === name || p.name?.toLowerCase() === name.toLowerCase()
      );
      if (existing?.id) {
        logger.info('Reusing existing Drive project folder', { userId, folderId: existing.id, name });
        return existing.id;
      }
    } catch (err) {
      logger.warn('Could not list projects before create', { error: err.message });
    }

    const createRes = await this.drivePost(
      '/drive/files',
      { parentFolderId: rootFolderId, name, type: 'folder' },
      headers
    );
    const folderId = createRes.data?.data?.id;
    if (!folderId) {
      throw Object.assign(new Error('Drive did not return a project folder id'), {
        code: 'DRIVE_CREATE_ERROR',
      });
    }

    logger.info('Created Drive project folder for agent pipeline', { userId, folderId, name });
    return folderId;
  }

  /**
   * Write a file to Google Drive via drive-service.
   *
   * @param {string} userId
   * @param {string} filePath — relative path (e.g. 'src/main.py')
   * @param {string} code — file content
   * @param {string} sessionId
   * @param {string} [projectFolderId] — root folder ID in Drive
   * @returns {Promise<{ fileId, filePath, success }>}
   */
  async writeFile(userId, filePath, code, sessionId, projectFolderId, googleAccessToken) {
    await this.notifyStatus(sessionId, 'thinking', { step: 'fileAgent', file: filePath, userId });

    if (!projectFolderId) {
      const errMsg = 'Project folder ID is required before writing files';
      await this.notifyStatus(sessionId, 'error', { step: 'fileAgent', file: filePath, error: errMsg, userId });
      return { fileId: null, filePath, success: false, error: errMsg };
    }

    const driveHeaders = this.driveHeaders(userId, googleAccessToken);

    try {
      if (!googleAccessToken) {
        throw Object.assign(new Error('Google access token missing — re-login required'), {
          code: 'DRIVE_TOKEN_REQUIRED',
        });
      }

      const dirPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
      let parentId = projectFolderId;

      if (dirPath) {
        try {
          const ensureRes = await this.drivePost('/drive/ensure-path', {
            rootFolderId: projectFolderId,
            path: dirPath,
          }, driveHeaders);
          parentId = ensureRes.data?.data?.folderId || projectFolderId;
        } catch {
          logger.warn('Could not ensure path, using project root', { dirPath });
        }
      }

      const fileName = filePath.includes('/') ? filePath.substring(filePath.lastIndexOf('/') + 1) : filePath;

      const createRes = await this.drivePost('/drive/files', {
        parentFolderId: parentId,
        name: fileName,
        content: code,
        type: 'file',
      }, driveHeaders);

      const fileId = createRes.data?.data?.id || null;

      await this.notifyStatus(sessionId, 'complete', {
        step: 'fileAgent',
        file: filePath,
        fileId,
        userId,
      });

      logger.info('File written to Drive', { sessionId, filePath, fileId });

      return { fileId, filePath, success: true };
    } catch (err) {
      logger.error('FileAgent write failed', { sessionId, filePath, error: err.message });

      await this.notifyStatus(sessionId, 'error', {
        step: 'fileAgent',
        file: filePath,
        error: err.message,
        userId,
      });

      return { fileId: null, filePath, success: false, error: err.message };
    }
  }

  async run() {
    throw new Error('Use writeFile() instead of run()');
  }
}

module.exports = FileAgent;
