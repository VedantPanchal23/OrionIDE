/**
 * Orion IDE — Drive Service Environment Validation
 */
const { validateEnv } = require('../../../../shared/utils/validateEnv');

module.exports = () => validateEnv('drive-service',
  ['REDIS_URL', 'INTERNAL_SECRET'],
  ['DRIVE_SERVICE_SECRET'],
);
