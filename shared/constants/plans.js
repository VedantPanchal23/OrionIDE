/**
 * Orion IDE — Plan / entitlement catalog
 * Limits enforced by API gateway (and optionally services).
 */

const PLANS = Object.freeze({
  free: {
    id: 'free',
    name: 'Free',
    priceCents: 0,
    currency: 'usd',
    limits: {
      maxTerminals: 2,
      maxExecutionsPerMinute: 10,
      maxAgentPipelinesPerDay: 25,
      maxWorkspaceMb: 256,
      agentsEnabled: true,
      collabEnabled: true,
      gitRemoteEnabled: true,
      debuggerEnabled: true,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceCents: 2000,
    currency: 'usd',
    limits: {
      maxTerminals: 8,
      maxExecutionsPerMinute: 60,
      maxAgentPipelinesPerDay: 100,
      maxWorkspaceMb: 2048,
      agentsEnabled: true,
      collabEnabled: true,
      gitRemoteEnabled: true,
      debuggerEnabled: true,
    },
  },
  team: {
    id: 'team',
    name: 'Team',
    priceCents: 4900,
    currency: 'usd',
    limits: {
      maxTerminals: 20,
      maxExecutionsPerMinute: 120,
      maxAgentPipelinesPerDay: 500,
      maxWorkspaceMb: 10240,
      agentsEnabled: true,
      collabEnabled: true,
      gitRemoteEnabled: true,
      debuggerEnabled: true,
    },
  },
});

const DEFAULT_PLAN_ID = 'free';

const getPlan = (planId) => PLANS[planId] || PLANS[DEFAULT_PLAN_ID];

module.exports = { PLANS, DEFAULT_PLAN_ID, getPlan };
