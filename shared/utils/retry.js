/**
 * Orion IDE — Retry with exponential backoff + jitter
 * Used for Google Drive API and inter-service Drive calls.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {Error|object} err
 * @returns {boolean}
 */
const isRetryable = (err) => {
  const status = err?.status || err?.code || err?.response?.status;
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  if (status === 'ECONNRESET' || status === 'ETIMEDOUT' || status === 'EAI_AGAIN') {
    return true;
  }
  const msg = String(err?.message || '');
  if (/rate limit|quota|userRateLimitExceeded|backendError|timed out/i.test(msg)) {
    return true;
  }
  // googleapis often puts status on err.code as number-like or err.response
  if (err?.errors?.[0]?.reason === 'rateLimitExceeded' || err?.errors?.[0]?.reason === 'userRateLimitExceeded') {
    return true;
  }
  return false;
};

/**
 * Extract Retry-After seconds if present.
 */
const retryAfterMs = (err) => {
  const h = err?.response?.headers?.['retry-after'] || err?.retryAfter;
  if (!h) return null;
  const n = Number(h);
  if (!Number.isNaN(n)) return Math.min(n * 1000, 60000);
  return null;
};

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ retries?: number, baseMs?: number, maxMs?: number, onRetry?: Function }} [opts]
 * @returns {Promise<T>}
 */
const withRetry = async (fn, opts = {}) => {
  const retries = opts.retries ?? 4;
  const baseMs = opts.baseMs ?? 300;
  const maxMs = opts.maxMs ?? 8000;
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt >= retries || !isRetryable(err)) throw err;
      const after = retryAfterMs(err);
      const expo = Math.min(maxMs, baseMs * (2 ** attempt));
      const jitter = Math.floor(Math.random() * expo * 0.3);
      const delay = after ?? expo + jitter;
      if (opts.onRetry) opts.onRetry(err, attempt + 1, delay);
      await sleep(delay);
    }
  }
  throw lastErr;
};

module.exports = { withRetry, isRetryable, retryAfterMs, sleep };
