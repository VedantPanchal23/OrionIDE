/**
 * Orion IDE — User repository (Postgres)
 */

const { query, isEnabled, isReady } = require('./db');
const { DEFAULT_PLAN_ID, getPlan } = require('../../../../shared/constants/plans');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('auth-service');

/**
 * Upsert Google identity on login.
 * @param {{ userId: string, email: string, name?: string, picture?: string }} profile
 */
const upsertUser = async (profile) => {
  if (!isEnabled() || !isReady()) return null;

  const { rows } = await query(
    `INSERT INTO users (id, email, name, picture, plan_id, last_login_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       name = COALESCE(EXCLUDED.name, users.name),
       picture = COALESCE(EXCLUDED.picture, users.picture),
       last_login_at = NOW(),
       updated_at = NOW()
     RETURNING *`,
    [
      profile.userId,
      profile.email,
      profile.name || null,
      profile.picture || null,
      DEFAULT_PLAN_ID,
    ]
  );

  logger.debug('User upserted', { userId: profile.userId });
  return mapUser(rows[0]);
};

const getUserById = async (userId) => {
  if (!isEnabled() || !isReady()) return null;
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
  return rows[0] ? mapUser(rows[0]) : null;
};

const updateProfile = async (userId, { name, preferences }) => {
  if (!isEnabled() || !isReady()) {
    throw Object.assign(new Error('Database not available'), { code: 'DB_DISABLED', status: 503 });
  }

  const { rows } = await query(
    `UPDATE users SET
       name = COALESCE($2, name),
       preferences = CASE WHEN $3::jsonb IS NULL THEN preferences ELSE preferences || $3::jsonb END,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId, name ?? null, preferences ? JSON.stringify(preferences) : null]
  );

  if (!rows[0]) {
    throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND', status: 404 });
  }
  return mapUser(rows[0]);
};

const setPlan = async (userId, planId) => {
  if (!isEnabled() || !isReady()) return null;
  const plan = getPlan(planId);
  const { rows } = await query(
    `INSERT INTO users (id, email, plan_id, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE SET plan_id = EXCLUDED.plan_id, updated_at = NOW()
     RETURNING *`,
    [userId, `${userId}@users.orion.local`, plan.id]
  );
  return rows[0] ? mapUser(rows[0]) : null;
};

const mapUser = (row) => ({
  userId: row.id,
  email: row.email,
  name: row.name,
  picture: row.picture,
  planId: row.plan_id,
  plan: getPlan(row.plan_id),
  stripeCustomerId: row.stripe_customer_id,
  preferences: row.preferences || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastLoginAt: row.last_login_at,
});

module.exports = {
  upsertUser,
  getUserById,
  updateProfile,
  setPlan,
};
