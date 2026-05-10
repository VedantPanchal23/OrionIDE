/**
 * Orion IDE — Drive Service Environment Validation
 */
const { validateEnv } = require('../../../../shared/utils/validateEnv');

module.exports = () => validateEnv('drive-service',
  ['REDIS_URL'],
  ['DRIVE_SERVICE_SECRET'],
);
