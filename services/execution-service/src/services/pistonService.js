/**
 * Orion IDE — Piston Execution Service
 *
 * Interfaces with the Piston code execution API.
 * Now uses the shared language registry for all 18 languages.
 */

const axios = require('axios');
const { getRedisClient } = require('./redisClient');
const { getById, getByExtension, getByPistonId, getExecutableLanguages, buildPistonRequest } = require('./languageMap');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('execution-service');

const PISTON_URL = process.env.PISTON_API_URL || process.env.PISTON_URL || 'https://emkc.org/api/v2/piston';
const RUN_TIMEOUT = 30000;
const RUNTIMES_CACHE_KEY = 'exec:runtimes';
const RUNTIMES_CACHE_TTL = 21600; // 6 hours

/**
 * Execute code via Piston.
 *
 * @param {string} languageId — language ID from registry (e.g. 'python')
 * @param {string} fileName — file name (e.g. 'main.py')
 * @param {string} code — source code
 * @param {string} [stdin] — optional stdin
 * @returns {Promise<{ stdout, stderr, exitCode, time, timedOut, language, version }>}
 */
const execute = async (languageId, fileName, code, stdin = '') => {
  // Support both language ID and raw piston language name
  let lang = getById(languageId);
  if (!lang) lang = getByPistonId(languageId);
  if (!lang || !lang.pistonLanguage) {
    throw Object.assign(new Error(`Unsupported language: ${languageId}`), { code: 'EXEC_UNSUPPORTED_LANG' });
  }

  const pistonBody = buildPistonRequest(lang.id, fileName, code, stdin);
  const startTime = Date.now();

  try {
    const response = await axios.post(`${PISTON_URL}/execute`, pistonBody, {
      timeout: RUN_TIMEOUT + 5000,
      headers: { 'Content-Type': 'application/json' },
    });

    const result = response.data;
    const runResult = result.run || {};

    return {
      stdout: runResult.stdout || '',
      stderr: runResult.stderr || '',
      exitCode: runResult.code != null ? runResult.code : (runResult.signal ? 128 : -1),
      time: ((Date.now() - startTime) / 1000).toFixed(3),
      timedOut: runResult.signal === 'SIGKILL' || false,
      language: result.language,
      version: result.version,
    };
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return {
        stdout: '',
        stderr: 'Execution timed out after 30 seconds.',
        exitCode: 124,
        time: ((Date.now() - startTime) / 1000).toFixed(3),
        timedOut: true,
      };
    }

    logger.error('Piston execution failed', { error: err.message });
    throw Object.assign(new Error('Execution engine unavailable'), { code: 'EXEC_ENGINE_ERROR' });
  }
};

/**
 * Get available runtimes from Piston. Cached in Redis for 6 hours.
 */
const getLanguages = async () => {
  try {
    const redis = await getRedisClient();
    const cached = await redis.get(RUNTIMES_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* cache miss */ }

  const response = await axios.get(`${PISTON_URL}/runtimes`, { timeout: 10000 });
  const runtimes = response.data;

  try {
    const redis = await getRedisClient();
    await redis.set(RUNTIMES_CACHE_KEY, JSON.stringify(runtimes), { EX: RUNTIMES_CACHE_TTL });
  } catch { /* cache write failure */ }

  return runtimes;
};

/**
 * Check if a specific language runtime is available in Piston.
 */
const isLanguageAvailable = async (pistonLanguage) => {
  try {
    const runtimes = await getLanguages();
    return runtimes.some((r) => r.language === pistonLanguage);
  } catch {
    return false;
  }
};

/**
 * Get all 18 languages with availability status.
 */
const getLanguagesWithStatus = async () => {
  let runtimes = [];
  try {
    runtimes = await getLanguages();
  } catch { /* Piston unreachable */ }

  const runtimeSet = new Set(runtimes.map((r) => r.language));

  return getExecutableLanguages().map((lang) => ({
    id: lang.id,
    displayName: lang.displayName,
    icon: lang.icon,
    color: lang.color,
    pistonLanguage: lang.pistonLanguage,
    pistonVersion: lang.pistonVersion,
    available: runtimeSet.has(lang.pistonLanguage),
    extensions: lang.extensions,
  }));
};

/**
 * Resolve language from extension or ID — backward compat.
 */
const resolveLanguage = (language) => {
  let lang = getById(language);
  if (lang) return { id: lang.id, pistonLanguage: lang.pistonLanguage, version: lang.pistonVersion, displayName: lang.displayName };
  lang = getByExtension(language);
  if (lang) return { id: lang.id, pistonLanguage: lang.pistonLanguage, version: lang.pistonVersion, displayName: lang.displayName };
  lang = getByPistonId(language);
  if (lang) return { id: lang.id, pistonLanguage: lang.pistonLanguage, version: lang.pistonVersion, displayName: lang.displayName };
  return null;
};

module.exports = {
  execute,
  getLanguages,
  isLanguageAvailable,
  getLanguagesWithStatus,
  resolveLanguage,
};
