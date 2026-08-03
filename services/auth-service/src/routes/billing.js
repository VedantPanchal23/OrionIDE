/**
 * Orion IDE — Billing routes (mounted under /billing on auth-service)
 */

const express = require('express');
const {
  getEntitlements,
  assertCanExecute,
  assertCanStartAgent,
  assertFeature,
  changePlan,
  createCheckoutSession,
  handleStripeWebhook,
  PLANS,
} = require('../services/billingService');
const { verifyAccessToken } = require('../services/tokenService');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('auth-service');
const router = express.Router();

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || process.env.DRIVE_SERVICE_SECRET || '';

const extractBearer = (req) => {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
};

const requireUser = (req, res) => {
  try {
    const token = extractBearer(req);
    if (!token) {
      res.status(401).json({ error: { code: 'AUTH_INVALID', message: 'No token', details: null } });
      return null;
    }
    const decoded = verifyAccessToken(token);
    req.userId = decoded.userId;
    return decoded;
  } catch (err) {
    res.status(401).json({
      error: { code: err.code || 'AUTH_INVALID', message: err.message, details: null },
    });
    return null;
  }
};

const requireInternal = (req, res) => {
  const secret = req.headers['x-internal-secret'] || req.headers['x-orion-service-secret'];
  if (!INTERNAL_SECRET || secret !== INTERNAL_SECRET) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid internal secret', details: null } });
    return false;
  }
  return true;
};

// GET /billing/plans — public catalog
router.get('/plans', (_req, res) => {
  res.json({
    data: {
      plans: Object.values(PLANS).map((p) => ({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        currency: p.currency,
        limits: p.limits,
      })),
    },
  });
});

// GET /billing/entitlements — current user (or internal with X-User-Id)
router.get('/entitlements', async (req, res) => {
  try {
    let userId = null;
    const token = extractBearer(req);
    if (token) {
      try {
        userId = verifyAccessToken(token).userId;
      } catch {
        // fall through
      }
    }
    if (!userId && requireInternal(req, res) === false) return;
    if (!userId) userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ error: { code: 'AUTH_INVALID', message: 'User required', details: null } });
    }
    const data = await getEntitlements(userId);
    res.json({ data });
  } catch (err) {
    logger.error('entitlements failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// Internal: check execution quota
router.post('/check/execute', async (req, res) => {
  if (!requireInternal(req, res)) return;
  try {
    const userId = req.headers['x-user-id'] || req.body?.userId;
    const result = await assertCanExecute(userId);
    res.status(result.allowed ? 200 : 429).json({ data: result });
  } catch (err) {
    logger.warn('check/execute failed — allowing', { error: err.message });
    res.json({ data: { allowed: true, degraded: true } });
  }
});

// Internal: check agent quota
router.post('/check/agent', async (req, res) => {
  if (!requireInternal(req, res)) return;
  try {
    const userId = req.headers['x-user-id'] || req.body?.userId;
    const result = await assertCanStartAgent(userId);
    res.status(result.allowed ? 200 : 429).json({ data: result });
  } catch (err) {
    logger.warn('check/agent failed — allowing', { error: err.message });
    res.json({ data: { allowed: true, degraded: true } });
  }
});

// Internal: feature gate
router.post('/check/feature', async (req, res) => {
  if (!requireInternal(req, res)) return;
  try {
    const userId = req.headers['x-user-id'] || req.body?.userId;
    const feature = req.body?.feature;
    const result = await assertFeature(userId, feature);
    res.status(result.allowed ? 200 : 403).json({ data: result });
  } catch (err) {
    logger.warn('check/feature failed — allowing', { error: err.message });
    res.json({ data: { allowed: true, degraded: true } });
  }
});

// POST /billing/checkout — Stripe or stub
router.post('/checkout', async (req, res) => {
  if (!requireUser(req, res)) return;
  try {
    const data = await createCheckoutSession(req.userId, req.body?.planId);
    res.json({ data });
  } catch (err) {
    res.status(err.status || 500).json({
      error: { code: err.code || 'BILLING_ERROR', message: err.message, details: null },
    });
  }
});

// POST /billing/plan — internal/dev plan change
router.post('/plan', async (req, res) => {
  if (!requireInternal(req, res)) return;
  const userId = req.headers['x-user-id'] || req.body?.userId;
  if (!userId || !req.body?.planId) {
    return res.status(400).json({
      error: { code: 'BILLING_MISSING_PARAM', message: 'userId and planId required', details: null },
    });
  }
  try {
    const user = await changePlan(userId, req.body.planId);
    res.json({ data: { user, entitlements: await getEntitlements(userId) } });
  } catch (err) {
    res.status(err.status || 500).json({
      error: { code: err.code || 'BILLING_ERROR', message: err.message, details: null },
    });
  }
});

// POST /billing/webhook — Stripe (raw body handled at app level for this path)
router.post('/webhook', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const raw = req.rawBody || JSON.stringify(req.body);
    const data = await handleStripeWebhook(raw, sig);
    res.json({ data });
  } catch (err) {
    logger.warn('Stripe webhook failed', { error: err.message });
    res.status(err.status || 400).json({
      error: { code: err.code || 'BILLING_WEBHOOK_ERROR', message: err.message, details: null },
    });
  }
});

module.exports = router;
