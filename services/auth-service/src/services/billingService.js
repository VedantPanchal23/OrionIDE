/**
 * Orion IDE — Billing / entitlements / usage
 */

const { query, isEnabled, isReady } = require('./db');
const { getUserById, setPlan } = require('./userService');
const { PLANS, DEFAULT_PLAN_ID, getPlan } = require('../../../../shared/constants/plans');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('auth-service');

const dayKey = () => new Date().toISOString().slice(0, 10);
const minuteKey = () => {
  const d = new Date();
  return `${d.toISOString().slice(0, 16)}`; // YYYY-MM-DDTHH:MM
};

/**
 * Resolve entitlements for a user (DB plan or free default).
 */
const getEntitlements = async (userId) => {
  let planId = DEFAULT_PLAN_ID;
  let user = null;

  if (isEnabled() && isReady() && userId) {
    user = await getUserById(userId);
    if (user?.planId) planId = user.planId;
  }

  const plan = getPlan(planId);
  return {
    userId,
    planId: plan.id,
    planName: plan.name,
    limits: plan.limits,
    features: {
      agents: plan.limits.agentsEnabled,
      collab: plan.limits.collabEnabled,
      gitRemote: plan.limits.gitRemoteEnabled,
      debugger: plan.limits.debuggerEnabled,
    },
    user: user
      ? { email: user.email, name: user.name, picture: user.picture }
      : null,
  };
};

/**
 * Ensure a users row exists so usage_counters / subscriptions FKs succeed
 * (minted JWTs may never have hit upsertUser on login).
 */
const ensureUserRow = async (userId) => {
  await query(
    `INSERT INTO users (id, email, plan_id, last_login_at, updated_at)
     VALUES ($1, $2, 'free', NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@users.orion.local`]
  );
};

/**
 * Increment a usage metric; returns { allowed, count, limit }.
 */
const checkAndIncrement = async (userId, metric, limit, windowKey) => {
  if (!userId) {
    return { allowed: false, count: 0, limit, reason: 'NO_USER' };
  }

  // Without DB, allow (gateway still has rate limits)
  if (!isEnabled() || !isReady()) {
    return { allowed: true, count: 0, limit, degraded: true };
  }

  try {
    await ensureUserRow(userId);
    const { rows } = await query(
      `INSERT INTO usage_counters (user_id, metric, window_key, count, updated_at)
       VALUES ($1, $2, $3, 1, NOW())
       ON CONFLICT (user_id, metric, window_key)
       DO UPDATE SET count = usage_counters.count + 1, updated_at = NOW()
       RETURNING count`,
      [userId, metric, windowKey]
    );

    const count = rows[0].count;
    const allowed = count <= limit;
    return { allowed, count, limit };
  } catch (err) {
    logger.warn('usage counter failed — allowing (degraded)', {
      userId,
      metric,
      error: err.message,
    });
    return { allowed: true, count: 0, limit, degraded: true };
  }
};

const assertCanExecute = async (userId) => {
  const ent = await getEntitlements(userId);
  return checkAndIncrement(
    userId,
    'executions',
    ent.limits.maxExecutionsPerMinute,
    minuteKey()
  );
};

const assertCanStartAgent = async (userId) => {
  const ent = await getEntitlements(userId);
  const { flags } = require('../../../../shared/utils/featureFlags');
  const agentsOk = ent.limits.agentsEnabled || flags().agentsOnFree;
  if (!agentsOk) {
    return {
      allowed: false,
      count: 0,
      limit: 0,
      reason: 'AGENTS_PRO_ONLY',
      entitlements: ent,
    };
  }
  const limit = Math.max(
    ent.limits.maxAgentPipelinesPerDay || 0,
    flags().agentsOnFree ? 25 : 0,
  );
  return checkAndIncrement(
    userId,
    'agent_pipelines',
    limit,
    dayKey()
  );
};

const assertFeature = async (userId, featureKey) => {
  const ent = await getEntitlements(userId);
  const { flags } = require('../../../../shared/utils/featureFlags');
  let enabled = Boolean(ent.features[featureKey]);
  if (!enabled && featureKey === 'agents' && flags().agentsOnFree) {
    enabled = true;
  }
  if (!enabled && featureKey === 'debugger' && flags().debuggerOnFree) {
    enabled = true;
  }
  return { allowed: enabled, entitlements: ent };
};

/**
 * Dev/admin: change plan without Stripe (guarded by INTERNAL_SECRET).
 */
const changePlan = async (userId, planId) => {
  if (!PLANS[planId]) {
    throw Object.assign(new Error('Unknown plan'), { code: 'BILLING_UNKNOWN_PLAN', status: 400 });
  }
  const user = await setPlan(userId, planId);
  if (isEnabled() && isReady()) {
    await query(
      `INSERT INTO subscriptions (user_id, plan_id, status)
       VALUES ($1, $2, 'active')`,
      [userId, planId]
    );
    await query(
      `INSERT INTO billing_events (user_id, type, payload)
       VALUES ($1, 'plan_changed', $2::jsonb)`,
      [userId, JSON.stringify({ planId })]
    );
  }
  logger.info('Plan changed', { userId, planId });
  return user;
};

/**
 * Stripe Checkout stub — returns URL placeholder until Stripe keys are set.
 */
const createCheckoutSession = async (userId, planId) => {
  if (!PLANS[planId] || planId === 'free') {
    throw Object.assign(new Error('Invalid plan for checkout'), {
      code: 'BILLING_INVALID_PLAN',
      status: 400,
    });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    // Dev / OSS: upgrade immediately so Upgrade CTA works without Stripe keys
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_BILLING !== 'true') {
      throw Object.assign(
        new Error('Billing checkout is not available — Stripe is not configured'),
        { code: 'BILLING_STRIPE_DISABLED', status: 402 },
      );
    }
    await changePlan(userId, planId);
    return {
      mode: 'dev',
      upgraded: true,
      planId,
      checkoutUrl: `${process.env.FRONTEND_URL || 'http://localhost:3010'}/billing?success=1&plan=${encodeURIComponent(planId)}`,
    };
  }

  // Lazy require so Stripe is optional
  const Stripe = require('stripe');
  const stripe = new Stripe(stripeKey);
  const ent = await getEntitlements(userId);
  let customerId = ent.user && (await getUserById(userId))?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { orionUserId: userId },
      email: ent.user?.email || undefined,
    });
    customerId = customer.id;
    if (isEnabled() && isReady()) {
      await query(
        `UPDATE users SET stripe_customer_id = $2, updated_at = NOW() WHERE id = $1`,
        [userId, customerId]
      );
    }
  }

  const priceId = process.env[`STRIPE_PRICE_${planId.toUpperCase()}`];
  if (!priceId) {
    throw Object.assign(new Error(`Missing STRIPE_PRICE_${planId.toUpperCase()}`), {
      code: 'BILLING_PRICE_MISSING',
      status: 503,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL || 'http://localhost:3010'}/billing?success=1`,
    cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3010'}/billing?canceled=1`,
    metadata: { orionUserId: userId, planId },
  });

  return { mode: 'stripe', checkoutUrl: session.url, sessionId: session.id };
};

const handleStripeWebhook = async (rawBody, signature) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    throw Object.assign(new Error('Stripe webhook not configured'), {
      code: 'BILLING_STRIPE_DISABLED',
      status: 503,
    });
  }

  const Stripe = require('stripe');
  const stripe = new Stripe(stripeKey);
  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.orionUserId;
    const planId = session.metadata?.planId;
    if (userId && planId) {
      await changePlan(userId, planId);
    }
  }

  if (isEnabled() && isReady()) {
    await query(
      `INSERT INTO billing_events (user_id, type, payload) VALUES ($1, $2, $3::jsonb)`,
      [
        event.data?.object?.metadata?.orionUserId || null,
        event.type,
        JSON.stringify(event.data?.object || {}),
      ]
    );
  }

  return { received: true, type: event.type };
};

module.exports = {
  getEntitlements,
  assertCanExecute,
  assertCanStartAgent,
  assertFeature,
  changePlan,
  createCheckoutSession,
  handleStripeWebhook,
  PLANS,
};
