/**
 * Orion IDE — Feature flags (ops kill-switches)
 *
 * Env vars default to conservative "off" for unfinished product surfaces.
 * Plan entitlements still apply when a flag is on.
 */

const truthy = (v, defaultValue = false) => {
  if (v === undefined || v === null || v === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};

const flags = () => ({
  /** Yjs / CRDT collab WebSocket rooms */
  yjsCollab: truthy(process.env.ENABLE_YJS_COLLAB, false),
  /** Debugger session API */
  debuggerApi: truthy(process.env.ENABLE_DEBUGGER_API, false),
  /** Agent pipeline (also Pro-gated) */
  agents: truthy(process.env.ENABLE_AGENTS, true),
  /** Allow agent on free plan (dev only) — default false */
  agentsOnFree: truthy(process.env.ENABLE_AGENTS_ON_FREE, false),
});

module.exports = { flags, truthy };
