/**
 * Orion IDE — File Agent
 *
 * Writes generated files to Google Drive via the drive-service.
 * No LLM — pure service-to-service calls.
 */

const BaseAgent = require('./baseAgent');
const axios = require('axios');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');

const DRIVE_SERVICE_URL = process.env.DRIVE_SERVICE_URL || 'http://drive-service:3003';

class FileAgent extends BaseAgent {
  constructor() {
    super('FileAgent', null, null);
  }

  getSystemPrompt() {
    return null; // No LLM
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
  async writeFile(userId, filePath, code, sessionId, projectFolderId) {
    await this.notifyStatus(sessionId, 'thinking', { step: 'fileAgent', file: filePath });

    try {
      // Ensure parent folders exist
      const dirPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
      let parentId = projectFolderId;

      if (dirPath) {
        try {
          const ensureRes = await axios.post(`${DRIVE_SERVICE_URL}/drive/ensure-path`, {
            rootFolderId: projectFolderId,
            path: dirPath,
          }, {
            headers: { 'X-User-Id': userId },
            timeout: 15000,
          });
          parentId = ensureRes.data?.data?.folderId || projectFolderId;
        } catch {
          logger.warn('Could not ensure path, using project root', { dirPath });
        }
      }

      // Create or update the file
      const fileName = filePath.includes('/') ? filePath.substring(filePath.lastIndexOf('/') + 1) : filePath;

      const createRes = await axios.post(`${DRIVE_SERVICE_URL}/drive/files`, {
        parentFolderId: parentId,
        name: fileName,
        content: code,
        type: 'file',
      }, {
        headers: { 'X-User-Id': userId },
        timeout: 15000,
      });

      const fileId = createRes.data?.data?.id || null;

      await this.notifyStatus(sessionId, 'complete', {
        step: 'fileAgent',
        file: filePath,
        fileId,
      });

      logger.info('File written to Drive', { sessionId, filePath, fileId });

      return { fileId, filePath, success: true };
    } catch (err) {
      logger.error('FileAgent write failed', { sessionId, filePath, error: err.message });

      await this.notifyStatus(sessionId, 'error', {
        step: 'fileAgent',
        file: filePath,
        error: err.message,
      });

      return { fileId: null, filePath, success: false, error: err.message };
    }
  }

  async run() {
    throw new Error('Use writeFile() instead of run()');
  }
}

module.exports = FileAgent;
