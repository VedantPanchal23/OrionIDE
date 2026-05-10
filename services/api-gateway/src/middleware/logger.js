/**
 * Orion IDE — API Gateway Request Logger Middleware
 *
 * Structured request/response logging for observability.
 *   - Generates a unique requestId (uuid) for every request
 *   - Attaches X-Request-Id header to all responses
 *   - Logs: method, path, statusCode, duration, userId, requestId
 *   - Uses the shared Winston logger
 */

const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('api-gateway');

/**
 * Request logging middleware.
 *
 * Runs at the top of the middleware stack:
 *   1. Generates a UUID requestId and attaches it to req and res
 *   2. Records the start time
 *   3. On response finish, logs the complete request details
 */
const requestLogger = (req, res, next) => {
  // Generate unique request ID
  const requestId = uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Record start time for duration calculation
  const startTime = process.hrtime.bigint();

  // Hook into the response finish event to log after the response is sent
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6; // nanoseconds → milliseconds

    const logData = {
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration: `${durationMs.toFixed(2)}ms`,
      userId: req.user?.id || req.user?.userId || null,
      userAgent: req.headers['user-agent'] || null,
      ip: req.ip || req.headers['x-forwarded-for'] || null,
    };

    // Log level based on status code
    if (res.statusCode >= 500) {
      logger.error('Request failed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
};

module.exports = { requestLogger };
