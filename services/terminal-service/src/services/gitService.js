/**
 * Orion IDE — Git operations on terminal workspace projects
 *
 * Workspace layout: {WORKSPACE_ROOT}/{userId}/{projectId}/
 * Uses system `git` (installed in terminal-service image).
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { WORKSPACE_ROOT, sanitizeId, ensureWorkspaceRoot } = require('./workspaceSync');

const execFileAsync = promisify(execFile);

const projectRoot = (userId, projectId) =>
  path.join(WORKSPACE_ROOT, sanitizeId(userId), sanitizeId(projectId));

/**
 * @param {string} cwd
 * @param {string[]} args
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
async function git(cwd, args) {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      maxBuffer: 5 * 1024 * 1024,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'Orion IDE',
        GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'orion@localhost',
        GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || 'Orion IDE',
        GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || 'orion@localhost',
      },
    });
    return { stdout: stdout || '', stderr: stderr || '' };
  } catch (err) {
    const error = new Error(err.stderr?.trim() || err.message || 'git command failed');
    error.code = 'GIT_ERROR';
    error.status = 400;
    error.stdout = err.stdout || '';
    error.stderr = err.stderr || '';
    throw error;
  }
}

async function ensureRepo(cwd) {
  if (!fs.existsSync(cwd)) {
    const err = new Error('Project workspace not found — open a terminal on this project first to sync from Drive');
    err.code = 'GIT_NO_WORKSPACE';
    err.status = 404;
    throw err;
  }
  const gitDir = path.join(cwd, '.git');
  if (!fs.existsSync(gitDir)) {
    await git(cwd, ['init', '-b', 'main']);
    await git(cwd, ['config', 'user.name', process.env.GIT_AUTHOR_NAME || 'Orion IDE']);
    await git(cwd, ['config', 'user.email', process.env.GIT_AUTHOR_EMAIL || 'orion@localhost']);
  }
}

/**
 * Parse `git status --porcelain=v1` into staged / unstaged / untracked.
 * @param {string} porcelain
 */
function parseStatus(porcelain) {
  const staged = [];
  const unstaged = [];
  const untracked = [];

  for (const line of porcelain.split('\n')) {
    if (!line || line.length < 3) continue;
    const x = line[0];
    const y = line[1];
    let filePath = line.slice(3);
    // rename: "R  old -> new"
    if (filePath.includes(' -> ')) {
      filePath = filePath.split(' -> ').pop();
    }

    if (x === '?' && y === '?') {
      untracked.push({ path: filePath, status: 'untracked' });
      continue;
    }

    if (x !== ' ' && x !== '?') {
      staged.push({ path: filePath, status: statusLetter(x) });
    }
    if (y !== ' ' && y !== '?') {
      unstaged.push({ path: filePath, status: statusLetter(y) });
    }
  }

  return { staged, unstaged, untracked };
}

function statusLetter(letter) {
  const map = {
    M: 'modified',
    A: 'added',
    D: 'deleted',
    R: 'renamed',
    C: 'copied',
    U: 'unmerged',
  };
  return map[letter] || letter;
}

/**
 * @param {string} userId
 * @param {string} projectId
 */
async function getStatus(userId, projectId) {
  const cwd = projectRoot(userId, projectId);
  await ensureRepo(cwd);

  const { stdout } = await git(cwd, ['status', '--porcelain=v1']);
  const lists = parseStatus(stdout);

  let branch = 'main';
  try {
    const { stdout: b } = await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
    branch = (b || 'main').trim() || 'main';
  } catch {
    // empty repo / detached
  }

  return { ...lists, branch, projectId, cwd };
}

/**
 * Stage paths then commit. Frontend stages client-side then posts files[].
 * @param {string} userId
 * @param {string} projectId
 * @param {{ message: string, files?: string[] }} opts
 */
async function commit(userId, projectId, { message, files = [] }) {
  if (!message || !String(message).trim()) {
    const err = new Error('Commit message is required');
    err.code = 'GIT_MISSING_MESSAGE';
    err.status = 400;
    throw err;
  }

  const cwd = projectRoot(userId, projectId);
  await ensureRepo(cwd);

  if (files.length > 0) {
    for (const f of files) {
      const rel = String(f).replace(/\\/g, '/').replace(/^\//, '');
      if (!rel || rel.includes('..')) continue;
      await git(cwd, ['add', '--', rel]);
    }
  } else {
    await git(cwd, ['add', '-A']);
  }

  const { stdout } = await git(cwd, ['commit', '-m', String(message).trim()]);
  let branch = 'main';
  try {
    const { stdout: b } = await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
    branch = (b || 'main').trim();
  } catch { /* ignore */ }

  return { committed: true, message: String(message).trim(), branch, output: stdout.trim() };
}

/**
 * @param {string} userId
 * @param {string} projectId
 * @param {string[]} files
 */
async function stage(userId, projectId, files = []) {
  const cwd = projectRoot(userId, projectId);
  await ensureRepo(cwd);
  if (!files.length) {
    await git(cwd, ['add', '-A']);
  } else {
    for (const f of files) {
      const rel = String(f).replace(/\\/g, '/').replace(/^\//, '');
      if (!rel || rel.includes('..')) continue;
      await git(cwd, ['add', '--', rel]);
    }
  }
  return getStatus(userId, projectId);
}

/**
 * @param {string} userId
 * @param {string} projectId
 * @param {string[]} files
 */
async function unstage(userId, projectId, files = []) {
  const cwd = projectRoot(userId, projectId);
  await ensureRepo(cwd);
  if (!files.length) {
    await git(cwd, ['reset', 'HEAD']);
  } else {
    for (const f of files) {
      const rel = String(f).replace(/\\/g, '/').replace(/^\//, '');
      if (!rel || rel.includes('..')) continue;
      await git(cwd, ['reset', 'HEAD', '--', rel]);
    }
  }
  return getStatus(userId, projectId);
}

async function getLog(userId, projectId, limit = 20) {
  const cwd = projectRoot(userId, projectId);
  await ensureRepo(cwd);
  const n = Math.min(Math.max(Number(limit) || 20, 1), 100);
  try {
    const { stdout } = await git(cwd, [
      'log',
      `-${n}`,
      '--pretty=format:%H%x09%an%x09%ae%x09%ad%x09%s',
      '--date=iso-strict',
    ]);
    const commits = stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, author, email, date, ...rest] = line.split('\t');
        return { hash, author, email, date, message: rest.join('\t') };
      });
    return { commits };
  } catch {
    return { commits: [] };
  }
}

/** Validate remote URL — allow https/git/ssh only */
function assertRemoteUrl(url) {
  const u = String(url || '').trim();
  if (!u || u.length > 2048) {
    const err = new Error('Invalid remote URL');
    err.code = 'GIT_BAD_REMOTE';
    err.status = 400;
    throw err;
  }
  if (!/^(https:\/\/|git@|ssh:\/\/|git:\/\/)/i.test(u)) {
    const err = new Error('Remote URL must be https, ssh, or git');
    err.code = 'GIT_BAD_REMOTE';
    err.status = 400;
    throw err;
  }
  return u;
}

async function listRemotes(userId, projectId) {
  const cwd = projectRoot(userId, projectId);
  await ensureRepo(cwd);
  const { stdout } = await git(cwd, ['remote', '-v']);
  const remotes = {};
  for (const line of stdout.split('\n').filter(Boolean)) {
    const [name, rest] = line.split(/\s+/);
    const url = rest?.replace(/\s*\(.*\)$/, '');
    if (!remotes[name]) remotes[name] = { name, fetch: null, push: null };
    if (line.includes('(fetch)')) remotes[name].fetch = url;
    if (line.includes('(push)')) remotes[name].push = url;
  }
  return { remotes: Object.values(remotes) };
}

async function setRemote(userId, projectId, { name = 'origin', url }) {
  const cwd = projectRoot(userId, projectId);
  await ensureRepo(cwd);
  const remoteUrl = assertRemoteUrl(url);
  const remoteName = String(name || 'origin').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64) || 'origin';
  try {
    await git(cwd, ['remote', 'remove', remoteName]);
  } catch {
    // may not exist
  }
  await git(cwd, ['remote', 'add', remoteName, remoteUrl]);
  return listRemotes(userId, projectId);
}

async function pull(userId, projectId, { remote = 'origin', branch } = {}) {
  const cwd = projectRoot(userId, projectId);
  await ensureRepo(cwd);
  const args = ['pull', '--ff-only', remote];
  if (branch) args.push(String(branch));
  const { stdout, stderr } = await git(cwd, args);
  return { ok: true, stdout: stdout.trim(), stderr: stderr.trim(), ...(await getStatus(userId, projectId)) };
}

async function push(userId, projectId, { remote = 'origin', branch, setUpstream = false } = {}) {
  const cwd = projectRoot(userId, projectId);
  await ensureRepo(cwd);
  const args = ['push'];
  if (setUpstream) args.push('-u');
  args.push(remote);
  if (branch) args.push(String(branch));
  const { stdout, stderr } = await git(cwd, args);
  return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
}

async function cloneRemote(userId, projectId, { url, branch }) {
  const remoteUrl = assertRemoteUrl(url);
  ensureWorkspaceRoot();
  const cwd = projectRoot(userId, projectId);
  if (fs.existsSync(path.join(cwd, '.git'))) {
    const err = new Error('Workspace already has a git repo — use pull instead');
    err.code = 'GIT_ALREADY_INIT';
    err.status = 409;
    throw err;
  }
  fs.mkdirSync(path.dirname(cwd), { recursive: true });
  if (fs.existsSync(cwd) && fs.readdirSync(cwd).length > 0) {
    // clone into existing non-empty dir is messy — require empty or missing
    const err = new Error('Workspace directory is not empty');
    err.code = 'GIT_DIR_NOT_EMPTY';
    err.status = 409;
    throw err;
  }
  const args = ['clone'];
  if (branch) args.push('-b', String(branch));
  args.push(remoteUrl, cwd);
  const { stdout, stderr } = await git(path.dirname(cwd), args);
  return { ok: true, cwd, stdout: stdout.trim(), stderr: stderr.trim() };
}

async function listBranches(userId, projectId) {
  const cwd = projectRoot(userId, projectId);
  await ensureRepo(cwd);
  const { stdout } = await git(cwd, ['branch', '-a', '--format=%(refname:short)%09%(HEAD)']);
  const branches = stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, head] = line.split('\t');
      return { name, current: head === '*' };
    });
  return { branches };
}

async function checkoutBranch(userId, projectId, { branch, create = false }) {
  if (!branch) {
    const err = new Error('branch is required');
    err.code = 'GIT_MISSING_BRANCH';
    err.status = 400;
    throw err;
  }
  const cwd = projectRoot(userId, projectId);
  await ensureRepo(cwd);
  const args = create ? ['checkout', '-b', String(branch)] : ['checkout', String(branch)];
  await git(cwd, args);
  return getStatus(userId, projectId);
}

module.exports = {
  getStatus,
  commit,
  stage,
  unstage,
  getLog,
  listRemotes,
  setRemote,
  pull,
  push,
  cloneRemote,
  listBranches,
  checkoutBranch,
  projectRoot,
  parseStatus,
};
