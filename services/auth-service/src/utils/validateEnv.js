/**
 * Orion IDE — Auth Service Environment Validation
 */
const { validateEnv } = require('../../../../shared/utils/validateEnv');

module.exports = () => validateEnv('auth-service',
  ['REDIS_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'],
  ['JWT_ACCESS_EXPIRY', 'JWT_REFRESH_EXPIRY'],
);
