/**
 * Orion IDE — Language Map Service
 *
 * Wraps the shared language registry for execution-service use.
 * Provides lookups and Piston request building.
 */

const { LANGUAGES, getLanguageByExtension, getLanguageById, getLanguageByPistonId, getExecutableLanguages } = require('../../../../shared/constants/languages');

/**
 * Build a Piston API execution request body.
 *
 * @param {string} languageId — language ID from registry
 * @param {string} fileName — file name (e.g. 'main.py')
 * @param {string} code — source code
 * @param {string} [stdin] — optional stdin
 * @returns {object} Piston request body
 */
const buildPistonRequest = (languageId, fileName, code, stdin) => {
  const lang = getLanguageById(languageId);
  if (!lang || !lang.pistonLanguage) {
    throw Object.assign(
      new Error(`Language '${languageId}' is not executable`),
      { code: 'EXEC_UNSUPPORTED_LANG' },
    );
  }

  return {
    language: lang.pistonLanguage,
    version: lang.pistonVersion || '*',
    files: [{ name: fileName, content: code }],
    stdin: stdin || '',
  };
};

/**
 * Get language from a file extension (with or without dot).
 */
const getByExtension = (ext) => getLanguageByExtension(ext);

/**
 * Get language by ID.
 */
const getById = (id) => getLanguageById(id);

/**
 * Get language by Piston language name.
 */
const getByPistonId = (pistonId) => getLanguageByPistonId(pistonId);

module.exports = {
  LANGUAGES,
  getByExtension,
  getById,
  getByPistonId,
  getExecutableLanguages,
  buildPistonRequest,
};
