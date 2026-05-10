/**
 * Orion IDE — Notification Service Environment Validation
 */
const { validateEnv } = require('../../../../shared/utils/validateEnv');

module.exports = () => validateEnv('notification-service',
  ['REDIS_URL'],
  [],
);
