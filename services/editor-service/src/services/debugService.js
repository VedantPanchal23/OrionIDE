/**
 * Orion IDE — Debugger session registry + live DAP adapters
 *
 * Redis stores session metadata; dap/manager owns live Python/Node adapters.
 */

const { v4: uuidv4 } = require('uuid');
const { getRedisClient } = require('./redisClient');
const dapManager = require('./dap/manager');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('editor-service');

const KEY = (id) => `debug:session:${id}`;
const USER_KEY = (userId) => `debug:user:${userId}`;
const TTL = 60 * 60 * 6;
const MAX_EVENTS = 200;

const COMMANDS = new Set([
  'continue',
  'next',
  'stepIn',
  'stepOut',
  'pause',
  'stop',
  'restart',
  'configurationDone',
  'launch',
]);

const appendEvents = (session, newEvents) => {
  const events = Array.isArray(session.events) ? [...session.events] : [];
  for (const ev of newEvents) events.push(ev);
  while (events.length > MAX_EVENTS) events.shift();
  return events;
};

const createSession = async (userId, config = {}) => {
  const sessionId = uuidv4();
  const session = {
    sessionId,
    userId,
    status: 'created',
    type: config.type || 'node',
    request: config.request || 'launch',
    program: config.program || null,
    cwd: config.cwd || null,
    projectId: config.projectId || null,
    args: config.args || [],
    env: config.env || {},
    stopOnEntry: config.stopOnEntry !== false,
    breakpoints: [],
    stackFrames: [],
    variables: [],
    adapter: null,
    events: [
      {
        type: 'session_created',
        at: new Date().toISOString(),
        payload: { type: config.type || 'node', request: config.request || 'launch' },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const redis = await getRedisClient();
  await redis.set(KEY(sessionId), JSON.stringify(session), { EX: TTL });
  await redis.sAdd(USER_KEY(userId), sessionId);
  await redis.expire(USER_KEY(userId), TTL);
  return session;
};

const getSession = async (sessionId) => {
  const redis = await getRedisClient();
  const raw = await redis.get(KEY(sessionId));
  return raw ? JSON.parse(raw) : null;
};

const updateSession = async (sessionId, patch) => {
  const session = await getSession(sessionId);
  if (!session) return null;
  const next = { ...session, ...patch, updatedAt: new Date().toISOString() };
  const redis = await getRedisClient();
  await redis.set(KEY(sessionId), JSON.stringify(next), { EX: TTL });
  return next;
};

const pushEvent = async (sessionId, type, payload = {}) => {
  const session = await getSession(sessionId);
  if (!session) return null;
  return updateSession(sessionId, {
    events: appendEvents(session, [{ type, at: new Date().toISOString(), payload }]),
  });
};

const bindAdapterEvents = (sessionId) => (event, payload) => {
  setImmediate(async () => {
    try {
      if (event === 'stopped') {
        let stackFrames = [];
        try {
          stackFrames = (await dapManager.stackTrace(sessionId)).map((f) => ({
            id: f.id,
            name: f.name,
            line: f.line,
            column: f.column,
            path: f.path,
          }));
        } catch { /* ignore */ }
        let variables = [];
        try {
          variables = await dapManager.variables(sessionId);
        } catch { /* ignore */ }
        const sess = await getSession(sessionId);
        await updateSession(sessionId, {
          status: 'stopped',
          stackFrames,
          variables,
          events: appendEvents(sess || { events: [] }, [
            {
              type: 'stopped',
              at: new Date().toISOString(),
              payload: { reason: payload.reason, threadId: payload.threadId, stackFrames },
            },
          ]),
        });
      } else if (event === 'continued') {
        await updateSession(sessionId, {
          status: 'running',
          stackFrames: [],
          events: appendEvents(await getSession(sessionId) || { events: [] }, [
            { type: 'continued', at: new Date().toISOString(), payload },
          ]),
        });
      } else if (event === 'terminated') {
        await updateSession(sessionId, {
          status: 'terminated',
          stackFrames: [],
          variables: [],
          adapter: null,
          events: appendEvents(await getSession(sessionId) || { events: [] }, [
            { type: 'terminated', at: new Date().toISOString(), payload },
          ]),
        });
      } else if (event === 'output') {
        await pushEvent(sessionId, 'output', payload);
      } else if (event === 'error') {
        await pushEvent(sessionId, 'adapter_error', payload);
      }
    } catch (err) {
      logger.warn('Failed to persist DAP event', { sessionId, event, error: err.message });
    }
  });
};

const setBreakpoints = async (sessionId, breakpoints) => {
  const session = await getSession(sessionId);
  if (!session) return null;

  const normalized = (Array.isArray(breakpoints) ? breakpoints : []).map((bp) => ({
    id: bp.id || uuidv4(),
    fileId: bp.fileId || bp.source || null,
    path: bp.path || null,
    line: Number(bp.line) || 0,
    column: bp.column != null ? Number(bp.column) : null,
    verified: Boolean(bp.verified),
    condition: bp.condition || null,
  }));

  let verified = normalized;
  if (dapManager.isLive(sessionId)) {
    try {
      verified = await dapManager.setBreakpoints(sessionId, normalized, session);
    } catch (err) {
      logger.warn('Live setBreakpoints failed', { sessionId, error: err.message });
    }
  }

  const merged = normalized.map((bp) => {
    const hit = (verified || []).find((v) => v.line === bp.line && (!bp.path || !v.path || v.path.endsWith(bp.path) || v.path === bp.path));
    return {
      ...bp,
      verified: hit ? Boolean(hit.verified) : Boolean(bp.verified),
      message: hit?.message,
    };
  });

  await updateSession(sessionId, { breakpoints: merged });
  await pushEvent(sessionId, 'breakpoints_set', { count: merged.length });
  return getSession(sessionId);
};

/**
 * Launch the language DAP adapter for this session.
 */
const launchAdapter = async (sessionId) => {
  const session = await getSession(sessionId);
  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    err.code = 'DEBUG_NOT_FOUND';
    throw err;
  }

  const result = await dapManager.launch(session, {
    stopOnEntry: session.stopOnEntry !== false,
    onEvent: bindAdapterEvents(sessionId),
  });

  // configurationDone for Python DAP after breakpoints
  if (dapManager.isLive(sessionId) && !result.alreadyRunning) {
    const entry = dapManager.getLive(sessionId);
    if (entry?.adapter?.configurationDone) {
      try {
        await entry.adapter.configurationDone();
      } catch (err) {
        logger.warn('configurationDone failed', { sessionId, error: err.message });
      }
    }
  }

  if (result.verified?.length) {
    const bps = (session.breakpoints || []).map((bp) => {
      const hit = result.verified.find((v) => v.line === bp.line);
      return hit ? { ...bp, verified: hit.verified, message: hit.message } : bp;
    });
    await updateSession(sessionId, { breakpoints: bps });
  }

  // Give the adapter a moment to deliver the entry stopped event + frames
  if (session.stopOnEntry !== false) {
    for (let i = 0; i < 10; i += 1) {
      await new Promise((r) => setTimeout(r, 100));
      try {
        const frames = await dapManager.stackTrace(sessionId);
        if (frames.length) {
          const lean = frames.map((f) => ({
            id: f.id, name: f.name, line: f.line, column: f.column, path: f.path,
          }));
          let variables = [];
          try { variables = await dapManager.variables(sessionId); } catch { /* ignore */ }
          const sess = await getSession(sessionId);
          return updateSession(sessionId, {
            status: 'stopped',
            stackFrames: lean,
            variables,
            adapter: { type: result.type || session.type, program: result.program, cwd: result.cwd },
            events: appendEvents(sess || session, [
              {
                type: 'adapter_launched',
                at: new Date().toISOString(),
                payload: { type: result.type, program: result.program, cwd: result.cwd },
              },
              {
                type: 'command_configurationDone',
                at: new Date().toISOString(),
                payload: { command: 'configurationDone' },
              },
            ]),
          });
        }
      } catch { /* keep polling */ }
    }
  }

  return updateSession(sessionId, {
    status: session.stopOnEntry !== false ? 'stopped' : 'running',
    adapter: { type: result.type || session.type, program: result.program, cwd: result.cwd },
    events: appendEvents(session, [
      {
        type: 'adapter_launched',
        at: new Date().toISOString(),
        payload: { type: result.type, program: result.program, cwd: result.cwd },
      },
      {
        type: 'command_configurationDone',
        at: new Date().toISOString(),
        payload: { command: 'configurationDone' },
      },
    ]),
  });
};

/**
 * Apply a DAP-oriented control command (live adapter when available).
 */
const applyCommand = async (sessionId, command, body = {}) => {
  if (!COMMANDS.has(command)) {
    const err = new Error(`Unknown debug command: ${command}`);
    err.status = 400;
    err.code = 'DEBUG_UNKNOWN_COMMAND';
    throw err;
  }

  const session = await getSession(sessionId);
  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    err.code = 'DEBUG_NOT_FOUND';
    throw err;
  }

  // Launch / configurationDone starts the real adapter
  if (command === 'configurationDone' || command === 'launch') {
    return launchAdapter(sessionId);
  }

  // Restart: stop then re-launch
  if (command === 'restart') {
    if (dapManager.isLive(sessionId)) {
      await dapManager.stop(sessionId);
    }
    await updateSession(sessionId, {
      status: 'created',
      stackFrames: [],
      variables: [],
      adapter: null,
      events: appendEvents(session, [
        { type: 'command_restart', at: new Date().toISOString(), payload: { command: 'restart' } },
      ]),
    });
    return launchAdapter(sessionId);
  }

  // Live adapter commands
  if (dapManager.isLive(sessionId)) {
    const result = await dapManager.runCommand(sessionId, command);

    let stackFrames = session.stackFrames || [];
    let variables = session.variables || [];
    let status = result.status;

    if (command === 'stop') {
      stackFrames = [];
      variables = [];
      status = 'terminated';
    }

    // For step commands, wait briefly for stopped event to populate frames
    if (['next', 'stepIn', 'stepOut', 'pause'].includes(command)) {
      await new Promise((r) => setTimeout(r, 150));
      try {
        stackFrames = await dapManager.stackTrace(sessionId);
        variables = await dapManager.variables(sessionId);
        status = 'stopped';
      } catch { /* adapter may still be running toward next pause */ }
    }

    const events = appendEvents(session, [
      { type: `command_${command}`, at: new Date().toISOString(), payload: { command, ...body } },
    ]);
    if (status === 'terminated') {
      events.push({ type: 'terminated', at: new Date().toISOString(), payload: {} });
    }

    return updateSession(sessionId, {
      status,
      stackFrames,
      variables,
      adapter: status === 'terminated' ? null : session.adapter,
      events,
    });
  }

  // Fallback: metadata-only (adapter not launched yet)
  let status = session.status;
  let stackFrames = session.stackFrames || [];
  let variables = session.variables || [];

  switch (command) {
    case 'continue':
      status = 'running';
      stackFrames = [];
      break;
    case 'next':
    case 'stepIn':
    case 'stepOut':
    case 'pause':
      status = 'stopped';
      break;
    case 'stop':
      status = 'terminated';
      stackFrames = [];
      variables = [];
      break;
    default:
      break;
  }

  const events = appendEvents(session, [
    { type: `command_${command}`, at: new Date().toISOString(), payload: { command, ...body } },
  ]);
  if (status === 'stopped') {
    events.push({ type: 'stopped', at: new Date().toISOString(), payload: { reason: command, stackFrames } });
  }
  if (status === 'terminated') {
    events.push({ type: 'terminated', at: new Date().toISOString(), payload: {} });
  }

  return updateSession(sessionId, { status, stackFrames, variables, events });
};

const listUserSessions = async (userId) => {
  const redis = await getRedisClient();
  const ids = await redis.sMembers(USER_KEY(userId));
  const sessions = [];
  for (const id of ids) {
    const s = await getSession(id);
    if (s) sessions.push(s);
    else await redis.sRem(USER_KEY(userId), id);
  }
  return sessions;
};

const destroySession = async (userId, sessionId) => {
  const session = await getSession(sessionId);
  if (!session) return false;
  if (session.userId !== userId) {
    const err = new Error('Not your debug session');
    err.status = 403;
    err.code = 'DEBUG_FORBIDDEN';
    throw err;
  }
  await dapManager.stop(sessionId);
  const redis = await getRedisClient();
  await redis.del(KEY(sessionId));
  await redis.sRem(USER_KEY(userId), sessionId);
  return true;
};

module.exports = {
  createSession,
  getSession,
  updateSession,
  setBreakpoints,
  applyCommand,
  launchAdapter,
  listUserSessions,
  destroySession,
  COMMANDS: [...COMMANDS],
};
