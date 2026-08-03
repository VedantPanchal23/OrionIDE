/**
 * Orion IDE — Problems / diagnostics store (Redis)
 *
 * Clients (Monaco markers, linters) push diagnostics; Problems panel reads them.
 */

const { getRedisClient } = require('./redisClient');

const KEY = (userId, projectId) => `editor:problems:${userId}:${projectId || 'default'}`;
const TTL = 60 * 60 * 24; // 24h

/**
 * @param {string} userId
 * @param {string} projectId
 * @param {Array<{ fileId: string, filePath?: string, diagnostics: object[] }>} files
 */
const setProblems = async (userId, projectId, files) => {
  const redis = await getRedisClient();
  const payload = {
    projectId: projectId || 'default',
    updatedAt: new Date().toISOString(),
    files: Array.isArray(files) ? files : [],
  };
  await redis.set(KEY(userId, projectId), JSON.stringify(payload), { EX: TTL });
  return payload;
};

/**
 * Replace diagnostics for a single file.
 */
const setFileProblems = async (userId, projectId, fileId, filePath, diagnostics) => {
  const current = (await getProblems(userId, projectId)) || {
    projectId: projectId || 'default',
    files: [],
  };
  const rest = current.files.filter((f) => f.fileId !== fileId);
  rest.push({
    fileId,
    filePath: filePath || null,
    diagnostics: Array.isArray(diagnostics) ? diagnostics : [],
  });
  return setProblems(userId, projectId, rest);
};

const getProblems = async (userId, projectId) => {
  const redis = await getRedisClient();
  const raw = await redis.get(KEY(userId, projectId));
  if (!raw) {
    return { projectId: projectId || 'default', files: [], updatedAt: null };
  }
  return JSON.parse(raw);
};

const clearProblems = async (userId, projectId) => {
  const redis = await getRedisClient();
  await redis.del(KEY(userId, projectId));
  return { cleared: true };
};

const summarize = (payload) => {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const f of payload.files || []) {
    for (const d of f.diagnostics || []) {
      const sev = d.severity ?? d.sev ?? 2;
      if (sev === 8 || sev === 'error') errors += 1;
      else if (sev === 4 || sev === 'warning') warnings += 1;
      else infos += 1;
    }
  }
  return { errors, warnings, infos, fileCount: (payload.files || []).length };
};

module.exports = { setProblems, setFileProblems, getProblems, clearProblems, summarize };
