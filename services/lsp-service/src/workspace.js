/**
 * Map virtual LSP URIs ↔ on-disk workspace paths.
 *
 * Client URI:  file:///workspace/{projectId}/{relPath}
 * Disk path:   {WORKSPACE_ROOT}/{userId}/{projectId}/{relPath}
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const WORKSPACE_ROOT = process.env.TERMINAL_WORKSPACE_ROOT
  || process.env.LSP_WORKSPACE_ROOT
  || (process.platform === 'win32'
    ? path.join(os.tmpdir(), 'orion-workspace')
    : '/workspace');

function sanitizeId(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function projectRoot(userId, projectId) {
  return path.join(WORKSPACE_ROOT, sanitizeId(userId), sanitizeId(projectId));
}

function ensureProjectRoot(userId, projectId) {
  const root = projectRoot(userId, projectId);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

/** file:///workspace/{projectId}/... → absolute disk path */
function uriToDiskPath(uri, userId, projectId) {
  if (!uri || typeof uri !== 'string') return null;
  let pathname = uri;
  if (uri.startsWith('file://')) {
    pathname = decodeURIComponent(uri.replace(/^file:\/\//, ''));
    // Windows file:///C:/... or file:///workspace/...
    if (pathname.startsWith('/') && /^[A-Za-z]:/.test(pathname.slice(1))) {
      pathname = pathname.slice(1);
    }
  }
  pathname = pathname.replace(/\\/g, '/');
  const marker = `/workspace/${sanitizeId(projectId)}/`;
  const idx = pathname.indexOf(marker);
  if (idx !== -1) {
    const rel = pathname.slice(idx + marker.length);
    return path.join(projectRoot(userId, projectId), ...rel.split('/').filter(Boolean));
  }
  // Already an absolute path under project root
  const root = projectRoot(userId, projectId);
  if (pathname.replace(/\\/g, '/').startsWith(root.replace(/\\/g, '/'))) {
    return pathname;
  }
  return null;
}

function diskPathToUri(diskPath, userId, projectId) {
  const root = projectRoot(userId, projectId);
  const rel = path.relative(root, diskPath).replace(/\\/g, '/');
  return `file:///workspace/${sanitizeId(projectId)}/${rel}`;
}

function virtualRootUri(projectId) {
  return `file:///workspace/${sanitizeId(projectId)}`;
}

/** Ensure a text document exists on disk so clangd/pyright can read it. */
function materializeDocument(userId, projectId, uri, text) {
  const disk = uriToDiskPath(uri, userId, projectId);
  if (!disk) return null;
  fs.mkdirSync(path.dirname(disk), { recursive: true });
  if (typeof text === 'string') {
    fs.writeFileSync(disk, text, 'utf8');
  } else if (!fs.existsSync(disk)) {
    fs.writeFileSync(disk, '', 'utf8');
  }
  return disk;
}

module.exports = {
  WORKSPACE_ROOT,
  projectRoot,
  ensureProjectRoot,
  uriToDiskPath,
  diskPathToUri,
  virtualRootUri,
  materializeDocument,
  sanitizeId,
};
