/**
 * Live DAP adapter manager — maps debug session IDs to language adapters.
 */

const path = require('path');
const fs = require('fs');
const { PythonDapAdapter } = require('./pythonAdapter');
const { NodeInspectorAdapter } = require('./nodeAdapter');
const { createLogger } = require('../../../../../shared/utils/logger');

const logger = createLogger('editor-service');

const WORKSPACE_ROOT = process.env.TERMINAL_WORKSPACE_ROOT
  || process.env.EDITOR_WORKSPACE_ROOT
  || '/workspace';

/** @type {Map<string, { adapter: object, type: string }>} */
const live = new Map();

const resolveCwd = (session) => {
  if (session.cwd && path.isAbsolute(session.cwd) && fs.existsSync(session.cwd)) {
    return session.cwd;
  }
  if (session.cwd && session.userId) {
    const candidate = path.join(WORKSPACE_ROOT, session.userId, session.cwd);
    if (fs.existsSync(candidate)) return candidate;
  }
  if (session.projectId && session.userId) {
    const candidate = path.join(WORKSPACE_ROOT, session.userId, session.projectId);
    if (fs.existsSync(candidate)) return candidate;
  }
  if (session.userId && session.program) {
    // Heuristic: workspace/{userId}/*/{program}
    const userRoot = path.join(WORKSPACE_ROOT, session.userId);
    if (fs.existsSync(userRoot)) {
      try {
        const projects = fs.readdirSync(userRoot);
        for (const p of projects) {
          const cwd = path.join(userRoot, p);
          const prog = path.join(cwd, session.program);
          if (fs.existsSync(prog)) return cwd;
        }
      } catch { /* ignore */ }
    }
  }
  return session.cwd || process.cwd();
};

const resolveProgram = (session, cwd) => {
  if (!session.program) {
    const err = new Error('program is required to launch a debug adapter');
    err.code = 'DEBUG_MISSING_PROGRAM';
    err.status = 400;
    throw err;
  }
  if (path.isAbsolute(session.program)) return session.program;
  return path.join(cwd, session.program);
};

const createAdapter = (type) => {
  const t = String(type || 'node').toLowerCase();
  if (t === 'python' || t === 'py') return { type: 'python', adapter: new PythonDapAdapter() };
  if (t === 'node' || t === 'javascript' || t === 'js' || t === 'typescript' || t === 'ts') {
    return { type: 'node', adapter: new NodeInspectorAdapter() };
  }
  const err = new Error(`Unsupported debug type: ${type}. Supported: python, node`);
  err.code = 'DEBUG_UNSUPPORTED_TYPE';
  err.status = 400;
  throw err;
};

/**
 * Launch language adapter for a session. Idempotent if already live.
 */
const launch = async (session, { stopOnEntry = true, onEvent } = {}) => {
  if (live.has(session.sessionId)) {
    return { alreadyRunning: true };
  }

  const cwd = resolveCwd(session);
  const program = resolveProgram(session, cwd);
  const { type, adapter } = createAdapter(session.type);

  const forward = (event, payload) => {
    if (typeof onEvent === 'function') onEvent(event, payload);
  };

  adapter.on('stopped', (p) => forward('stopped', p));
  adapter.on('continued', (p) => forward('continued', p));
  adapter.on('terminated', (p) => {
    forward('terminated', p);
    live.delete(session.sessionId);
  });
  adapter.on('output', (p) => forward('output', p));
  adapter.on('error', (err) => forward('error', { message: err.message }));

  logger.info('Launching debug adapter', {
    sessionId: session.sessionId,
    type,
    program,
    cwd,
  });

  await adapter.start({
    program,
    cwd,
    args: session.args || [],
    env: session.env || {},
    stopOnEntry,
  });

  // Apply any breakpoints already stored on the session
  let verified = [];
  if (Array.isArray(session.breakpoints) && session.breakpoints.length) {
    const withAbs = session.breakpoints.map((bp) => ({
      ...bp,
      path: bp.path
        ? (path.isAbsolute(bp.path) ? bp.path : path.join(cwd, bp.path))
        : program,
    }));
    verified = await adapter.setBreakpoints(withAbs);
  }

  live.set(session.sessionId, { adapter, type, cwd, program });

  // After breakpoints are installed, continue if not stopping on entry
  if (!stopOnEntry && type === 'node' && typeof adapter.continue === 'function') {
    try {
      await adapter.continue();
    } catch (err) {
      logger.warn('Post-breakpoint continue failed', { sessionId: session.sessionId, error: err.message });
    }
  }

  return { type, program, cwd, verified };
};

const getLive = (sessionId) => live.get(sessionId) || null;

const setBreakpoints = async (sessionId, breakpoints, session) => {
  const entry = live.get(sessionId);
  if (!entry) {
    // Not launched yet — store only; applied on launch
    return breakpoints.map((bp) => ({ ...bp, verified: false, pending: true }));
  }
  const cwd = entry.cwd;
  const program = entry.program;
  const withAbs = (breakpoints || []).map((bp) => ({
    ...bp,
    path: bp.path
      ? (path.isAbsolute(bp.path) ? bp.path : path.join(cwd, bp.path))
      : program,
  }));
  return entry.adapter.setBreakpoints(withAbs);
};

const runCommand = async (sessionId, command) => {
  const entry = live.get(sessionId);
  if (!entry) {
    const err = new Error('Debug adapter is not running — send configurationDone/launch first');
    err.code = 'DEBUG_NOT_RUNNING';
    err.status = 409;
    throw err;
  }
  const { adapter } = entry;

  switch (command) {
    case 'continue':
      await adapter.continue();
      return { status: 'running' };
    case 'next':
      await adapter.next();
      return { status: 'running' };
    case 'stepIn':
      await adapter.stepIn();
      return { status: 'running' };
    case 'stepOut':
      await adapter.stepOut();
      return { status: 'running' };
    case 'pause':
      await adapter.pause();
      return { status: 'stopped' };
    case 'stop':
      await adapter.stop();
      live.delete(sessionId);
      return { status: 'terminated' };
    case 'restart': {
      // Caller should re-launch; stop current
      await adapter.stop();
      live.delete(sessionId);
      return { status: 'terminated', restart: true };
    }
    default: {
      const err = new Error(`Adapter does not handle command: ${command}`);
      err.code = 'DEBUG_UNKNOWN_COMMAND';
      err.status = 400;
      throw err;
    }
  }
};

const stackTrace = async (sessionId) => {
  const entry = live.get(sessionId);
  if (!entry) return [];
  return entry.adapter.stackTrace();
};

const variables = async (sessionId, variablesReference = 1) => {
  const entry = live.get(sessionId);
  if (!entry) return [];
  if (entry.adapter.scopes && variablesReference) {
    // Prefer first scope's variables if adapter supports scopes
    try {
      const frames = await entry.adapter.stackTrace();
      if (!frames.length) return [];
      const scopes = await entry.adapter.scopes(frames[0].id);
      const scope = scopes[0];
      if (scope?.variablesReference) {
        return entry.adapter.variables(scope.variablesReference);
      }
      if (scope?._objectId != null) {
        return entry.adapter.variables(1);
      }
    } catch { /* fall through */ }
  }
  return entry.adapter.variables(variablesReference);
};

const stop = async (sessionId) => {
  const entry = live.get(sessionId);
  if (!entry) return false;
  try {
    await entry.adapter.stop();
  } catch { /* ignore */ }
  live.delete(sessionId);
  return true;
};

const isLive = (sessionId) => live.has(sessionId);

module.exports = {
  launch,
  getLive,
  setBreakpoints,
  runCommand,
  stackTrace,
  variables,
  stop,
  isLive,
  resolveCwd,
  WORKSPACE_ROOT,
};
