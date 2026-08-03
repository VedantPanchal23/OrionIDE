/**
 * Orion IDE — Terminal Service Environment Validation
 */
const { validateEnv } = require('../../../../shared/utils/validateEnv');

module.exports = () => validateEnv(
  'terminal-service',
  ['REDIS_URL'],
  ['DRIVE_SERVICE_URL', 'INTERNAL_SECRET', 'DRIVE_SERVICE_SECRET', 'TERMINAL_WORKSPACE_ROOT']
);
