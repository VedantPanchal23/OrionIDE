/**
 * Orion IDE — Environment Variable Validation
 *
 * Validates required environment variables on service startup.
 * Logs status for each variable and exits if any are missing.
 */

const { createLogger } = require('./logger');

/**
 * Validate required environment variables.
 *
 * @param {string} serviceName — service name for logging
 * @param {string[]} required — list of required env var names
 * @param {string[]} [optional] — list of optional env var names (logged but not fatal)
 */
const validateEnv = (serviceName, required, optional = []) => {
  // Skip validation in test environment
  if (process.env.NODE_ENV === 'test') return;

  const logger = createLogger(serviceName);
  let missing = [];

  logger.info('Validating environment variables...');

  // Check required
  required.forEach((key) => {
    if (process.env[key]) {
      const masked = process.env[key].length > 8
        ? process.env[key].substring(0, 4) + '****'
        : '****';
      logger.info(`  [ok] ${key} = ${masked}`);
    } else {
      logger.error(`  [missing] ${key} -- REQUIRED`);
      missing.push(key);
    }
  });

  // Check optional
  optional.forEach((key) => {
    if (process.env[key]) {
      logger.info(`  [ok] ${key} (optional)`);
    } else {
      logger.warn(`  [--] ${key} (optional, not set)`);
    }
  });

  if (missing.length > 0) {
    logger.error(`Missing ${missing.length} required env var(s): ${missing.join(', ')}`);
    logger.error('Exiting. Set missing variables in .env or environment.');
    process.exit(1);
  }

  logger.info(`Environment valid (${required.length} required, ${optional.length} optional)`);
};

module.exports = { validateEnv };
