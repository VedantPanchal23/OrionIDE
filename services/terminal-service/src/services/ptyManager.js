/**
 * Orion IDE — PTY Manager
 *
 * Manages node-pty shell sessions.
 *
 * Each session = one pseudo-terminal process (bash/sh).
 * Sessions are identified by a unique terminalId.
 * Max 5 terminals per user.
 */

const pty = require('node-pty');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

/** @type {Map<string, { pty: any, userId: string, createdAt: Date }>} */
const sessions = new Map();

/** @type {Map<string, Set<string>>} userId → set of terminalIds */
const userSessions = new Map();

const MAX_SESSIONS_PER_USER = 5;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Determine which shell to use.
 */
function getShell() {
  if (os.platform() === 'win32') {
    return 'powershell.exe';
  }
  // Prefer bash, fall back to sh
  try {
    require('child_process').execSync('which bash', { stdio: 'ignore' });
    return '/bin/bash';
  } catch {
    return '/bin/sh';
  }
}

/**
 * Create a new PTY session.
 *
 * @param {string} userId
 * @param {{ cols?: number, rows?: number, cwd?: string }} options
 * @returns {{ terminalId: string, shell: string }}
 */
function createSession(userId, options = {}) {
  // Enforce session limit
  const existing = userSessions.get(userId) || new Set();
  if (existing.size >= MAX_SESSIONS_PER_USER) {
    throw Object.assign(
      new Error(`Maximum ${MAX_SESSIONS_PER_USER} terminals per user`),
      { code: 'TERMINAL_LIMIT_EXCEEDED' }
    );
  }

  const terminalId = uuidv4();
  const shell = getShell();
  const cols = options.cols || 80;
  const rows = options.rows || 24;
  const cwd = options.cwd || (os.platform() === 'win32' ? os.homedir() : '/workspace');

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      LANG: 'en_US.UTF-8',
    },
  });

  sessions.set(terminalId, {
    pty: ptyProcess,
    userId,
    shell,
    cols,
    rows,
    createdAt: new Date(),
    lastActivity: Date.now(),
  });

  // Track per-user
  if (!userSessions.has(userId)) {
    userSessions.set(userId, new Set());
  }
  userSessions.get(userId).add(terminalId);

  return { terminalId, shell };
}

/**
 * Get a PTY session by ID.
 * @param {string} terminalId
 * @returns {object|null}
 */
function getSession(terminalId) {
  const session = sessions.get(terminalId);
  if (session) {
    session.lastActivity = Date.now();
  }
  return session || null;
}

/**
 * Write data to a PTY session (stdin).
 * @param {string} terminalId
 * @param {string} data
 */
function writeToSession(terminalId, data) {
  const session = sessions.get(terminalId);
  if (!session) return false;
  session.lastActivity = Date.now();
  session.pty.write(data);
  return true;
}

/**
 * Resize a PTY session.
 * @param {string} terminalId
 * @param {number} cols
 * @param {number} rows
 */
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

/**
 * Destroy a PTY session.
 * @param {string} terminalId
 */
function destroySession(terminalId) {
  const session = sessions.get(terminalId);
  if (!session) return;

  try {
    session.pty.kill();
  } catch {
    // Process may already be dead
  }

  // Remove from user tracking
  const userSet = userSessions.get(session.userId);
  if (userSet) {
    userSet.delete(terminalId);
    if (userSet.size === 0) {
      userSessions.delete(session.userId);
    }
  }

  sessions.delete(terminalId);
}

/**
 * List active terminals for a user.
 * @param {string} userId
 * @returns {Array<{ terminalId: string, shell: string, createdAt: Date }>}
 */
function listUserSessions(userId) {
  const ids = userSessions.get(userId) || new Set();
  return [...ids].map(id => {
    const s = sessions.get(id);
    return s ? {
      terminalId: id,
      shell: s.shell,
      cols: s.cols,
      rows: s.rows,
      createdAt: s.createdAt,
    } : null;
  }).filter(Boolean);
}

/**
 * Clean up idle sessions (called periodically).
 */
function cleanupIdleSessions() {
  const now = Date.now();
  for (const [terminalId, session] of sessions) {
    if (now - session.lastActivity > IDLE_TIMEOUT_MS) {
      console.log(`[pty-manager] Cleaning up idle session ${terminalId}`);
      destroySession(terminalId);
    }
  }
}

/**
 * Destroy all sessions (graceful shutdown).
 */
function destroyAll() {
  for (const terminalId of sessions.keys()) {
    destroySession(terminalId);
  }
}

/**
 * Get total session count.
 */
function getStats() {
  return {
    totalSessions: sessions.size,
    totalUsers: userSessions.size,
  };
}

module.exports = {
  createSession,
  getSession,
  writeToSession,
  resizeSession,
  destroySession,
  listUserSessions,
  cleanupIdleSessions,
  destroyAll,
  getStats,
};
