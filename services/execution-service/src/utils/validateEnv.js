/**
 * Orion IDE — Execution Service Environment Validation
 */
const { validateEnv } = require('../../../../shared/utils/validateEnv');

module.exports = () => validateEnv('execution-service',
  ['REDIS_URL', 'INTERNAL_SECRET', 'PISTON_API_URL'],
  [],
);
