/**
 * Orion IDE — Feature flags (ops kill-switches)
 *
 * Env vars align with OSS same-UI defaults (debugger + agents on free).
 * Plan entitlements still apply when a flag is on.
 */

const truthy = (v, defaultValue = false) => {
  if (v === undefined || v === null || v === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};

const flags = () => ({
  /** Yjs / CRDT collab WebSocket rooms */
  yjsCollab: truthy(process.env.ENABLE_YJS_COLLAB, false),
  /** Debugger session API — on by default for OSS same-UI */
  debuggerApi: truthy(process.env.ENABLE_DEBUGGER_API, true),
  /** Allow debugger on free plan (OSS / local) */
  debuggerOnFree: truthy(process.env.ENABLE_DEBUGGER_ON_FREE, true),
  /** Agent pipeline */
  agents: truthy(process.env.ENABLE_AGENTS, true),
  /** Allow agent on free plan (OSS same-UI) */
  agentsOnFree: truthy(process.env.ENABLE_AGENTS_ON_FREE, true),
});

module.exports = { flags, truthy };
