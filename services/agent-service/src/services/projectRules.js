/**
 * Load project rules from Drive (AGENTS.md or .orion/rules.md).
 */

const FileAgent = require('../agents/fileAgent');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');
const fileAgent = new FileAgent();

const MAX_RULES_CHARS = 12000;
const cache = new Map(); // key → { at, text }
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(userId, folderId) {
  return `${userId}:${folderId}`;
}

async function findNamedFile(headers, folderId, name) {
  try {
    const res = await fileAgent.driveGet(
      `/drive/files?folderId=${encodeURIComponent(folderId)}`,
      headers,
    );
    const files = res.data?.data?.files || [];
    return files.find((f) => !f.isFolder && f.name === name) || null;
  } catch (err) {
    logger.warn('list folder for rules failed', { error: err.message });
    return null;
  }
}

async function readFileContent(headers, fileId) {
  const res = await fileAgent.driveGet(`/drive/files/${encodeURIComponent(fileId)}`, headers);
  const content = res.data?.data?.content;
  return typeof content === 'string' ? content : '';
}

/**
 * @returns {Promise<string>}
 */
async function loadProjectRules(userId, projectFolderId, googleAccessToken) {
  if (!userId || !projectFolderId || !googleAccessToken) return '';

  const key = cacheKey(userId, projectFolderId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.text;

  const headers = fileAgent.driveHeaders(userId, googleAccessToken);
  let text = '';

  try {
    const agentsMd = await findNamedFile(headers, projectFolderId, 'AGENTS.md');
    if (agentsMd?.id) {
      text = await readFileContent(headers, agentsMd.id);
    } else {
      const orionDir = await findNamedFile(headers, projectFolderId, '.orion');
      // .orion may be a folder — list API marks isFolder
      const listRes = await fileAgent.driveGet(
        `/drive/files?folderId=${encodeURIComponent(projectFolderId)}`,
        headers,
      );
      const folders = (listRes.data?.data?.files || []).filter((f) => f.isFolder);
      const orionFolder = folders.find((f) => f.name === '.orion');
      if (orionFolder?.id) {
        const rules = await findNamedFile(headers, orionFolder.id, 'rules.md');
        if (rules?.id) text = await readFileContent(headers, rules.id);
      }
      void orionDir;
    }
  } catch (err) {
    logger.warn('loadProjectRules failed', { error: err.message });
    text = '';
  }

  text = String(text || '').trim().slice(0, MAX_RULES_CHARS);
  cache.set(key, { at: Date.now(), text });
  return text;
}

function appendRules(systemPrompt, rules) {
  const base = String(systemPrompt || '').trim();
  const r = String(rules || '').trim();
  if (!r) return base;
  return `${base}\n\n# Project rules (from AGENTS.md / .orion/rules.md)\nFollow these project-specific instructions:\n\n${r}`;
}

module.exports = { loadProjectRules, appendRules };
