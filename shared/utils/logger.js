/**
 * Orion IDE — Shared Winston Logger Factory
 * 
 * Usage in any service:
 *   const { createLogger } = require('../../shared/utils/logger');
 *   const logger = createLogger('auth-service');
 *   logger.info('Server started', { port: 3001 });
 * 
 * Log format:
 *   { timestamp, service, level, message, requestId?, userId?, ...meta }
 * 
 * Behavior:
 *   - Development: colorized, human-readable console output
 *   - Production:  JSON to stdout (for log aggregators like ELK, Datadog)
 */

const winston = require('winston');

/**
 * Create a namespaced logger instance for a service.
 * @param {string} serviceName — e.g. 'auth-service', 'drive-service'
 * @returns {winston.Logger}
 */
const createLogger = (serviceName) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // ── Custom format: inject service name into every log entry ────────
  const serviceFormat = winston.format((info) => {
    info.service = serviceName;
    return info;
  });

  // ── Development: colorized, readable output ───────────────────────
  const devFormat = winston.format.combine(
    serviceFormat(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, service, level, message, requestId, userId, ...meta }) => {
      let line = `${timestamp} [${service}] ${level}: ${message}`;
      if (requestId) line += ` | reqId=${requestId}`;
      if (userId) line += ` | userId=${userId}`;
      const extras = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
      return line + extras;
    })
  );

  // ── Production: structured JSON to stdout ─────────────────────────
  const prodFormat = winston.format.combine(
    serviceFormat(),
    winston.format.timestamp(),
    winston.format.json()
  );

  return winston.createLogger({
    level: isProduction ? 'info' : 'debug',
    format: isProduction ? prodFormat : devFormat,
    transports: [new winston.transports.Console()],
    // Do not exit on uncaught exceptions — let the process manager handle it
    exitOnError: false,
  });
};

module.exports = { createLogger };
