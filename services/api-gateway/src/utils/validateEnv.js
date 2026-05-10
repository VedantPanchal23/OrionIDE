/**
 * Orion IDE — API Gateway Environment Validation
 */
const { validateEnv } = require('../../../../shared/utils/validateEnv');

module.exports = () => validateEnv('api-gateway',
  ['REDIS_URL', 'AUTH_SERVICE_URL'],
  ['DRIVE_SERVICE_URL', 'EDITOR_SERVICE_URL', 'EXECUTION_SERVICE_URL', 'AGENT_SERVICE_URL', 'NOTIFICATION_SERVICE_URL'],
);
