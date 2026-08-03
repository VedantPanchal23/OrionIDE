/**
 * Orion IDE — Postgres pool (auth-service)
 * Graceful: if DATABASE_URL is unset, DB features no-op (dev without Postgres).
 */

const { Pool } = require('pg');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('auth-service');

let pool = null;
let ready = false;

const isEnabled = () => Boolean(process.env.DATABASE_URL);

const getPool = () => {
  if (!isEnabled()) return null;
  if (pool) return pool;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
  });
  pool.on('error', (err) => {
    logger.error('Postgres pool error', { error: err.message });
  });
  return pool;
};

const query = async (text, params) => {
  const p = getPool();
  if (!p) throw Object.assign(new Error('Database not configured'), { code: 'DB_DISABLED' });
  return p.query(text, params);
};

const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  picture       TEXT,
  plan_id       TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  preferences   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id               TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active',
  stripe_subscription_id TEXT,
  current_period_end    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE TABLE IF NOT EXISTS usage_counters (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric      TEXT NOT NULL,
  window_key  TEXT NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, metric, window_key)
);
CREATE TABLE IF NOT EXISTS billing_events (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const migrate = async () => {
  if (!isEnabled()) {
    logger.warn('DATABASE_URL not set — user DB / billing persistence disabled');
    ready = false;
    return false;
  }
  try {
    await query(SCHEMA_SQL);
    ready = true;
    logger.info('Postgres schema ready');
    return true;
  } catch (err) {
    logger.error('DB migrate failed', { error: err.message });
    ready = false;
    return false;
  }
};

const isReady = () => ready;

const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    ready = false;
  }
};

module.exports = { getPool, query, migrate, isEnabled, isReady, closePool };
