/**
 * Orion IDE — Google Drive API call wrapper (retry + normalize errors)
 */

const { withRetry } = require('../../../../shared/utils/retry');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('drive-service');

/**
 * Run a googleapis promise with retries on 429/5xx.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {string} op
 * @returns {Promise<T>}
 */
const driveApi = async (fn, op = 'drive') => {
  return withRetry(
    async () => {
      try {
        return await fn();
      } catch (err) {
        // Normalize googleapis errors
        const status = err?.response?.status || err?.code;
        const normalized = new Error(err?.message || 'Drive API error');
        normalized.status = typeof status === 'number' ? status : undefined;
        normalized.code = err?.errors?.[0]?.reason || err?.code || 'DRIVE_API_ERROR';
        normalized.response = err?.response;
        normalized.errors = err?.errors;
        if (typeof status === 'number') normalized.status = status;
        // userRateLimitExceeded often comes as 403
        if (
          err?.errors?.[0]?.reason === 'userRateLimitExceeded'
          || err?.errors?.[0]?.reason === 'rateLimitExceeded'
          || /rate limit|quota/i.test(err?.message || '')
        ) {
          normalized.status = 429;
        }
        throw normalized;
      }
    },
    {
      retries: Number(process.env.DRIVE_API_RETRIES) || 4,
      onRetry: (err, attempt, delay) => {
        logger.warn('Drive API retry', { op, attempt, delay, status: err.status, code: err.code });
      },
    }
  );
};

module.exports = { driveApi };
