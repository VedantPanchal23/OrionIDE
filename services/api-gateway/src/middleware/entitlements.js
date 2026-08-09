/**
 * Orion IDE — Entitlement gate middleware
 * Soft-enforces plan limits for execute / agents / collab-ish routes.
 *
 * Fail-open only when ENTITLEMENTS_FAIL_OPEN=true (or NODE_ENV=test).
 * Production defaults to fail-closed (503) if billing is unreachable.
 */

const axios = require('axios');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('api-gateway');
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
const SECRET = process.env.INTERNAL_SECRET || process.env.DRIVE_SERVICE_SECRET || '';

const failOpen = () => (
  process.env.ENTITLEMENTS_FAIL_OPEN === 'true'
  || process.env.NODE_ENV === 'test'
);

const denyUnavailable = (res, kind) => res.status(503).json({
  error: {
    code: 'ENTITLEMENTS_UNAVAILABLE',
    message: `Could not verify ${kind} quota — try again shortly`,
    details: null,
  },
});

const internalHeaders = (req) => ({
  'X-Internal-Secret': SECRET,
  'X-User-Id': req.user?.id || req.user?.userId || req.headers['x-user-id'] || '',
  'Content-Type': 'application/json',
});

/**
 * Gate POST /api/execute
 */
const requireExecuteQuota = async (req, res, next) => {
  try {
    const { data } = await axios.post(
      `${AUTH_SERVICE_URL}/billing/check/execute`,
      {},
      { headers: internalHeaders(req), timeout: 3000 }
    );
    if (data?.data && data.data.allowed === false) {
      return res.status(429).json({
        error: {
          code: 'PLAN_LIMIT_EXECUTE',
          message: 'Execution quota exceeded for your plan',
          details: data.data,
        },
      });
    }
    return next();
  } catch (err) {
    if (failOpen()) {
      logger.warn('Execute quota check failed — allowing (fail-open)', { error: err.message });
      return next();
    }
    logger.error('Execute quota check failed — denying', { error: err.message });
    return denyUnavailable(res, 'execute');
  }
};

/**
 * Gate POST /api/agents/pipeline/start
 */
const requireAgentQuota = async (req, res, next) => {
  try {
    const { data } = await axios.post(
      `${AUTH_SERVICE_URL}/billing/check/agent`,
      {},
      { headers: internalHeaders(req), timeout: 3000 }
    );
    if (data?.data && data.data.allowed === false) {
      const reason = data.data.reason;
      const status = reason === 'AGENTS_PRO_ONLY' ? 403 : 429;
      return res.status(status).json({
        error: {
          code: reason === 'AGENTS_PRO_ONLY' ? 'PLAN_FEATURE_LOCKED' : 'PLAN_LIMIT_AGENT',
          message: reason === 'AGENTS_PRO_ONLY'
            ? 'Agents require Pro or Team plan'
            : 'Daily agent request quota exceeded for your plan',
          details: data.data,
        },
      });
    }
    return next();
  } catch (err) {
    if (failOpen()) {
      logger.warn('Agent quota check failed — allowing (fail-open)', { error: err.message });
      return next();
    }
    logger.error('Agent quota check failed — denying', { error: err.message });
    return denyUnavailable(res, 'agent');
  }
};

/**
 * Gate a named feature (debugger, collab, gitRemote)
 */
const requireFeature = (feature) => async (req, res, next) => {
  try {
    const { data } = await axios.post(
      `${AUTH_SERVICE_URL}/billing/check/feature`,
      { feature },
      { headers: internalHeaders(req), timeout: 3000 }
    );
    if (data?.data && data.data.allowed === false) {
      return res.status(403).json({
        error: {
          code: 'PLAN_FEATURE_LOCKED',
          message: `Feature "${feature}" requires a higher plan`,
          details: data.data,
        },
      });
    }
    return next();
  } catch (err) {
    if (failOpen()) {
      logger.warn('Feature check failed — allowing (fail-open)', { feature, error: err.message });
      return next();
    }
    logger.error('Feature check failed — denying', { feature, error: err.message });
    return denyUnavailable(res, feature);
  }
};

module.exports = { requireExecuteQuota, requireAgentQuota, requireFeature };
