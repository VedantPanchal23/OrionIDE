/**
 * Orion IDE — Agent Service Environment Validation
 */
const { validateEnv } = require('../../../../shared/utils/validateEnv');

module.exports = () => validateEnv('agent-service',
  ['REDIS_URL', 'GROQ_API_KEY', 'OPENROUTER_API_KEY'],
  ['DRIVE_SERVICE_URL', 'EXECUTION_SERVICE_URL', 'NOTIFICATION_SERVICE_URL'],
);
