/**
 * Orion IDE — Execution Service Environment Validation
 */
const { validateEnv } = require('../../../../shared/utils/validateEnv');

module.exports = () => validateEnv('execution-service',
  ['REDIS_URL'],
  ['PISTON_API_URL'],
);
