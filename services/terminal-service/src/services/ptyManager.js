/**
 * Orion IDE — PTY Manager
 *
 * Manages node-pty shell sessions with sandboxing:
 * - cwd must resolve under per-user workspace root
 * - env is an allowlist (no secrets)
 * - each session has a connectToken required for WebSocket attach
 */

const pty = require('node-pty');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { WORKSPACE_ROOT, sanitizeId, ensureWorkspaceRoot } = require('./workspaceSync');

/** @type {Map<string, object>} */
const sessions = new Map();

/** @type {Map<string, Set<string>>} */
const userSessions = new Map();

const MAX_SESSIONS_PER_USER = Math.max(
  1,
  Number.parseInt(process.env.MAX_TERMINALS_PER_USER || '5', 10) || 5,
);
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const ENV_ALLOWLIST = [
  'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TERM', 'COLORTERM',
  'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'TMP', 'TEMP',
  'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'SYSTEMROOT', 'COMSPEC',
  'PATHEXT', 'WINDIR',
];

function getShell() {
  if (os.platform() === 'win32') return 'powershell.exe';
  try {
    require('child_process').execSync('which bash', { stdio: 'ignore' });
    return '/bin/bash';
  } catch {
    return '/bin/sh';
  }
}

function buildSafeEnv() {
  const env = {};
  for (const key of ENV_ALLOWLIST) {
    if (process.env[key] != null) env[key] = process.env[key];
  }
  env.TERM = 'xterm-256color';
  env.COLORTERM = 'truecolor';
  env.LANG = env.LANG || 'en_US.UTF-8';
  return env;
}

function userRoot(userId) {
  ensureWorkspaceRoot();
  const root = path.resolve(WORKSPACE_ROOT, sanitizeId(userId));
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  return root;
}

/**
 * Resolve and validate cwd under the user's workspace root.
 * @param {string} userId
 * @param {string|undefined} requestedCwd — relative path under user root, or absolute under user root
 * @returns {string}
 */
function resolveSafeCwd(userId, requestedCwd) {
  const root = userRoot(userId);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;

  let candidate;
  if (!requestedCwd || requestedCwd === '.' || requestedCwd === '/workspace') {
    candidate = root;
  } else if (path.isAbsolute(requestedCwd)) {
    candidate = path.resolve(requestedCwd);
  } else {
    candidate = path.resolve(root, requestedCwd);
  }

  if (candidate !== root && !candidate.startsWith(rootWithSep)) {
    throw Object.assign(new Error('cwd must be inside the user workspace'), {
      code: 'TERMINAL_INVALID_CWD',
    });
  }

  if (!fs.existsSync(candidate)) {
    fs.mkdirSync(candidate, { recursive: true });
  }

  return candidate;
}

function createSession(userId, options = {}) {
  const existing = userSessions.get(userId) || new Set();
  if (existing.size >= MAX_SESSIONS_PER_USER) {
    throw Object.assign(
      new Error(`Maximum ${MAX_SESSIONS_PER_USER} terminals per user`),
      { code: 'TERMINAL_LIMIT_EXCEEDED' }
    );
  }

  const terminalId = uuidv4();
  const connectToken = crypto.randomBytes(24).toString('hex');
  const shell = getShell();
  const cols = options.cols || 80;
  const rows = options.rows || 24;
  const cwd = resolveSafeCwd(userId, options.cwd);

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: buildSafeEnv(),
  });

  sessions.set(terminalId, {
    pty: ptyProcess,
    userId,
    connectToken,
    shell,
    cols,
    rows,
    cwd,
    projectFolderId: options.projectFolderId || null,
    googleAccessToken: options.googleAccessToken || null,
    createdAt: new Date(),
    lastActivity: Date.now(),
  });

  if (!userSessions.has(userId)) userSessions.set(userId, new Set());
  userSessions.get(userId).add(terminalId);

  return {
    terminalId,
    shell,
    connectToken,
    cwd,
    projectFolderId: options.projectFolderId || null,
  };
}

function getSession(terminalId) {
  const session = sessions.get(terminalId);
  if (session) session.lastActivity = Date.now();
  return session || null;
}

function writeToSession(terminalId, data) {
  const session = sessions.get(terminalId);
  if (!session) return false;
  session.lastActivity = Date.now();
  session.pty.write(data);
  return true;
}

function resizeSession(terminalId, cols, rows) {
  const session = sessions.get(terminalId);
  if (!session) return false;
  try {
    session.pty.resize(cols, rows);
    session.cols = cols;
    session.rows = rows;
    return true;
  } catch {
    return false;
  }
}

function destroySession(terminalId) {
  const session = sessions.get(terminalId);
  if (!session) return null;

  try { session.pty.kill(); } catch { /* already dead */ }

  const userSet = userSessions.get(session.userId);
  if (userSet) {
    userSet.delete(terminalId);
    if (userSet.size === 0) userSessions.delete(session.userId);
  }

  sessions.delete(terminalId);
  return session;
}

function listUserSessions(userId) {
  const ids = userSessions.get(userId) || new Set();
  return [...ids].map((id) => {
    const s = sessions.get(id);
    return s ? {
      terminalId: id,
      shell: s.shell,
      cols: s.cols,
      rows: s.rows,
      cwd: s.cwd,
      projectFolderId: s.projectFolderId,
      createdAt: s.createdAt,
    } : null;
  }).filter(Boolean);
}

function listIdleSessions() {
  const now = Date.now();
  const idle = [];
  for (const [terminalId, session] of sessions) {
    if (now - session.lastActivity > IDLE_TIMEOUT_MS) {
      idle.push({ ...session, terminalId });
    }
  }
  return idle;
}

function cleanupIdleSessions() {
  for (const session of listIdleSessions()) {
    destroySession(session.terminalId);
  }
}

function destroyAll() {
  for (const terminalId of [...sessions.keys()]) {
    destroySession(terminalId);
  }
}

function getStats() {
  return {
    totalSessions: sessions.size,
    totalUsers: userSessions.size,
    workspaceRoot: WORKSPACE_ROOT,
  };
}

/** Exported for unit tests */
function _testHelpers() {
  return { resolveSafeCwd, buildSafeEnv, WORKSPACE_ROOT, ENV_ALLOWLIST, userRoot };
}

module.exports = {
  createSession,
  getSession,
  writeToSession,
  resizeSession,
  destroySession,
  listUserSessions,
  listIdleSessions,
  cleanupIdleSessions,
  destroyAll,
  getStats,
  resolveSafeCwd,
  buildSafeEnv,
  userRoot,
  _testHelpers,
};
