/**
 * Orion IDE — Editor Service Environment Validation
 */
const { validateEnv } = require('../../../../shared/utils/validateEnv');

module.exports = () => validateEnv('editor-service',
  ['REDIS_URL'],
  [],
);
