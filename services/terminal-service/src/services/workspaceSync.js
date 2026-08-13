/**
 * Orion IDE — Drive ↔ Terminal Workspace Sync
 *
 * Pulls a Google Drive project folder into a per-user local workspace for PTY,
 * and pushes local changes back to Drive.
 *
 * Layout: {WORKSPACE_ROOT}/{userId}/{projectFolderId}/
 * Manifest: .orion-sync.json maps relative paths → Drive file/folder IDs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const WORKSPACE_ROOT = process.env.TERMINAL_WORKSPACE_ROOT
  || (os.platform() === 'win32' ? path.join(os.tmpdir(), 'orion-workspace') : '/workspace');

const DRIVE_SERVICE_URL = (process.env.DRIVE_SERVICE_URL || 'http://drive-service:3002').replace(/\/$/, '');
const MAX_DEPTH = Number(process.env.TERMINAL_SYNC_MAX_DEPTH) || 20;
const MAX_FILES = Number(process.env.TERMINAL_SYNC_MAX_FILES) || 500;
const MANIFEST_NAME = '.orion-sync.json';
const SKIP_NAMES = new Set([MANIFEST_NAME, '.git', 'node_modules', '.DS_Store']);
const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.pdf', '.zip', '.gz', '.tgz',
  '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.wasm', '.exe', '.dll', '.so', '.dylib',
  '.class', '.jar', '.pyc', '.pyo',
]);
const MAX_TEXT_BYTES = Number(process.env.TERMINAL_SYNC_MAX_TEXT_BYTES) || 2 * 1024 * 1024;
const MAX_BINARY_BYTES = Number(process.env.TERMINAL_SYNC_MAX_BINARY_BYTES) || 5 * 1024 * 1024;

const isProbablyBinary = (relPath, buffer) => {
  const ext = path.extname(relPath).toLowerCase();
  if (BINARY_EXTS.has(ext)) return true;
  if (!buffer || buffer.length === 0) return false;
  const sample = buffer.subarray(0, Math.min(8000, buffer.length));
  let suspicious = 0;
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    if (b === 0) return true;
    if (b < 7 || (b > 14 && b < 32)) suspicious += 1;
  }
  return suspicious / sample.length > 0.3;
};

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const sanitizeId = (id) => String(id || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);

const projectRoot = (userId, projectFolderId) =>
  path.join(WORKSPACE_ROOT, sanitizeId(userId), sanitizeId(projectFolderId));

function ensureWorkspaceRoot() {
  if (!fs.existsSync(WORKSPACE_ROOT)) {
    fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
  }
}

function buildHeaders({ userId, googleAccessToken, serviceSecret }) {
  const headers = {
    'Content-Type': 'application/json',
    'X-User-Id': userId,
    'X-Google-Access-Token': googleAccessToken,
  };
  if (serviceSecret) {
    headers['X-Internal-Secret'] = serviceSecret;
    headers['X-Orion-Service-Secret'] = serviceSecret;
  }
  return headers;
}

function driveRequestOnce(method, urlPath, { headers, body } = {}) {
  const url = new URL(`${DRIVE_SERVICE_URL}${urlPath}`);
  const lib = url.protocol === 'https:' ? https : http;
  const payload = body != null ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          ...headers,
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
        timeout: 30000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json;
          try { json = JSON.parse(text); } catch { json = { raw: text }; }
          if (res.statusCode >= 400) {
            const err = new Error(json?.error?.message || `Drive request failed (${res.statusCode})`);
            err.status = res.statusCode;
            err.code = json?.error?.code || 'DRIVE_SYNC_ERROR';
            err.retryAfter = res.headers['retry-after'];
            reject(err);
            return;
          }
          resolve(json?.data ?? json);
        });
      }
    );
    req.on('error', (err) => {
      err.code = err.code || 'ECONNRESET';
      reject(err);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(Object.assign(new Error('Drive request timed out'), { code: 'DRIVE_SYNC_TIMEOUT', status: 504 }));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function driveRequest(method, urlPath, opts = {}) {
  const { withRetry } = require('../../../../shared/utils/retry');
  return withRetry(
    () => driveRequestImpl(method, urlPath, opts),
    {
      retries: Number(process.env.TERMINAL_SYNC_RETRIES) || 4,
      baseMs: 400,
      maxMs: 10000,
    }
  );
}

/** @type {typeof driveRequestOnce} */
let driveRequestImpl = driveRequestOnce;

/** Test hook — restore with `_setDriveRequestForTests(null)`. */
function _setDriveRequestForTests(fn) {
  driveRequestImpl = typeof fn === 'function' ? fn : driveRequestOnce;
}

/**
 * Ask auth-service for a fresh Google access token (renews via Google refresh if needed).
 */
async function resolveFreshGoogleToken(userId, fallbackToken) {
  const authBase = (process.env.AUTH_SERVICE_URL || 'http://auth-service:3001').replace(/\/$/, '');
  const secret = process.env.INTERNAL_SECRET || process.env.DRIVE_SERVICE_SECRET || '';
  if (!userId || !secret) return fallbackToken || null;

  try {
    const url = new URL(`${authBase}/auth/internal/google-token`);
    const lib = url.protocol === 'https:' ? https : http;
    const data = await new Promise((resolve, reject) => {
      const req = lib.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: `${url.pathname}${url.search}`,
          method: 'GET',
          headers: {
            'X-User-Id': userId,
            'X-Internal-Secret': secret,
            Accept: 'application/json',
          },
          timeout: 8000,
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let json;
            try { json = JSON.parse(text); } catch { json = {}; }
            if (res.statusCode >= 400) {
              reject(Object.assign(new Error(json?.error?.message || `auth ${res.statusCode}`), {
                status: res.statusCode,
              }));
              return;
            }
            resolve(json?.data ?? json);
          });
        }
      );
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('auth token refresh timeout')); });
      req.end();
    });
    return data?.googleAccessToken || fallbackToken || null;
  } catch (err) {
    console.warn(`[terminal-sync] google token refresh failed: ${err.message}`);
    return fallbackToken || null;
  }
}

function readManifest(root) {
  const p = path.join(root, MANIFEST_NAME);
  if (!fs.existsSync(p)) return { version: 1, projectFolderId: null, files: {}, folders: {} };
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { version: 1, projectFolderId: null, files: {}, folders: {} };
  }
}

function writeManifest(root, manifest) {
  fs.writeFileSync(path.join(root, MANIFEST_NAME), JSON.stringify(manifest, null, 2), 'utf8');
}

/**
 * Recursively pull a Drive folder into localDir.
 */
async function pullFolder(folderId, localDir, ctx, depth, counters, manifest, relBase) {
  if (depth > MAX_DEPTH) return;
  fs.mkdirSync(localDir, { recursive: true });
  if (relBase) {
    manifest.folders[relBase.replace(/\\/g, '/')] = folderId;
  }

  const listed = await driveRequest('GET', `/drive/files?folderId=${encodeURIComponent(folderId)}`, {
    headers: ctx.headers,
  });
  const items = listed.files || [];

  // Drive allows duplicate sibling names; don't map both onto the same local path.
  const seenNames = new Set();

  for (const item of items) {
    if (!item?.name || SKIP_NAMES.has(item.name)) continue;
    const nameKey = String(item.name).toLowerCase();
    if (seenNames.has(nameKey)) {
      counters.skippedDuplicates = (counters.skippedDuplicates || 0) + 1;
      console.warn(`[terminal-sync] skipping duplicate Drive name "${item.name}" under ${relBase || '.'}`);
      continue;
    }
    seenNames.add(nameKey);

    if (counters.files >= MAX_FILES) {
      throw Object.assign(new Error(`Sync file limit exceeded (${MAX_FILES})`), { code: 'TERMINAL_SYNC_LIMIT' });
    }

    const rel = relBase ? path.join(relBase, item.name) : item.name;
    const relKey = rel.replace(/\\/g, '/');
    const target = path.join(localDir, item.name);

    if (item.isFolder || item.mimeType === 'application/vnd.google-apps.folder') {
      if (ctx.visitedFolders) ctx.visitedFolders.add(relKey);
      await pullFolder(item.id, target, ctx, depth + 1, counters, manifest, rel);
      continue;
    }

    if (ctx.visitedFiles) ctx.visitedFiles.add(relKey);

    // Resume: skip if already pulled with same Drive id and local file exists
    if (
      manifest.files[relKey] === item.id
      && fs.existsSync(target)
      && (!item.md5Checksum || manifest.remoteHashes?.[relKey] === item.md5Checksum)
    ) {
      counters.skipped = (counters.skipped || 0) + 1;
      continue;
    }

    const contentData = await driveRequest(
      'GET',
      `/drive/files/${encodeURIComponent(item.id)}?asBinary=1`,
      { headers: ctx.headers }
    );
    let content = typeof contentData.content === 'string'
      ? contentData.content
      : (contentData.content ?? '');

    // Prefer base64 from Drive (correct for binary); fall back to utf8 text
    let buffer;
    if (contentData.encoding === 'base64' && typeof content === 'string') {
      buffer = Buffer.from(content, 'base64');
    } else {
      buffer = Buffer.from(String(content), 'utf8');
    }

    const binary = isProbablyBinary(relKey, buffer);
    if (binary && buffer.length > MAX_BINARY_BYTES) {
      counters.skippedBinary = (counters.skippedBinary || 0) + 1;
      continue; // skip oversized binaries
    }
    if (!binary && buffer.length > MAX_TEXT_BYTES) {
      throw Object.assign(new Error(`File too large for text sync: ${relKey}`), {
        code: 'TERMINAL_SYNC_TOO_LARGE',
      });
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buffer);
    manifest.files[relKey] = item.id;
    manifest.hashes = manifest.hashes || {};
    manifest.hashes[relKey] = sha256(buffer);
    manifest.meta = manifest.meta || {};
    manifest.meta[relKey] = { binary, size: buffer.length };
    if (item.md5Checksum) {
      manifest.remoteHashes = manifest.remoteHashes || {};
      manifest.remoteHashes[relKey] = item.md5Checksum;
    }
    counters.files += 1;

    // Checkpoint every N files so interrupted pulls can resume
    if (counters.files % 10 === 0 && ctx.checkpointRoot) {
      writeManifest(ctx.checkpointRoot, manifest);
    }
  }
}

/**
 * Pull Drive project into per-user workspace. Returns absolute cwd.
 */
async function pullProject({ userId, projectFolderId, googleAccessToken }) {
  if (!userId || !projectFolderId || !googleAccessToken) {
    throw Object.assign(new Error('userId, projectFolderId, and googleAccessToken are required'), {
      code: 'TERMINAL_SYNC_PARAMS',
    });
  }

  ensureWorkspaceRoot();
  const root = projectRoot(userId, projectFolderId);
  fs.mkdirSync(root, { recursive: true });

  const serviceSecret = process.env.INTERNAL_SECRET || process.env.DRIVE_SERVICE_SECRET || '';
  const headers = buildHeaders({ userId, googleAccessToken, serviceSecret });
  const existing = readManifest(root);
  const resume = existing.projectFolderId === projectFolderId;

  const manifest = {
    version: 2,
    projectFolderId,
    syncedAt: new Date().toISOString(),
    files: resume ? { ...(existing.files || {}) } : {},
    folders: resume ? { ...(existing.folders || {}), '.': projectFolderId } : { '.': projectFolderId },
    hashes: resume ? { ...(existing.hashes || {}) } : {},
    meta: resume ? { ...(existing.meta || {}) } : {},
    remoteHashes: resume ? { ...(existing.remoteHashes || {}) } : {},
  };
  const counters = { files: 0, skipped: 0, skippedBinary: 0 };
  const ctx = { headers, checkpointRoot: root };
  const visitedFiles = new Set();
  const visitedFolders = new Set(['.']);
  ctx.visitedFiles = visitedFiles;
  ctx.visitedFolders = visitedFolders;

  await pullFolder(projectFolderId, root, ctx, 0, counters, manifest, '');

  // Drop manifest entries that no longer exist on Drive
  for (const rel of Object.keys(manifest.files || {})) {
    if (!visitedFiles.has(rel)) {
      delete manifest.files[rel];
      delete manifest.hashes?.[rel];
      delete manifest.meta?.[rel];
      delete manifest.remoteHashes?.[rel];
    }
  }
  for (const rel of Object.keys(manifest.folders || {})) {
    if (rel !== '.' && !visitedFolders.has(rel)) delete manifest.folders[rel];
  }

  // Prune local files/folders that are no longer on Drive so terminal
  // auto-push cannot resurrect IDE/Drive deletes.
  const keepFiles = new Set(Object.keys(manifest.files || {}));
  const keepFolders = new Set(Object.keys(manifest.folders || {}).filter((k) => k && k !== '.'));
  const pruned = pruneLocalAgainstManifest(root, keepFiles, keepFolders);
  counters.pruned = pruned.pruned || 0;

  writeManifest(root, manifest);

  quietAutoPushAfterPull(root);

  return {
    cwd: root,
    fileCount: counters.files,
    skipped: counters.skipped || 0,
    skippedBinary: counters.skippedBinary || 0,
    pruned: counters.pruned || 0,
    resumed: resume,
    projectFolderId,
  };
}

function walkLocalFiles(dir, base, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_NAMES.has(name)) continue;
    const full = path.join(dir, name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      walkLocalFiles(full, base, out);
    } else if (st.isFile()) {
      out.push({ rel, full });
    }
  }
}

/** Collect every directory under the workspace (relative paths, deepest last). */
function walkLocalDirs(dir, base, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_NAMES.has(name)) continue;
    const full = path.join(dir, name);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (!st.isDirectory()) continue;
    const rel = path.relative(base, full).replace(/\\/g, '/');
    walkLocalDirs(full, base, out);
    out.push({ rel, full });
  }
}

async function listChildrenCached(parentId, ctx) {
  if (!ctx.listCache) ctx.listCache = new Map();
  if (ctx.listCache.has(parentId)) return ctx.listCache.get(parentId);
  const listed = await driveRequest(
    'GET',
    `/drive/files?folderId=${encodeURIComponent(parentId)}`,
    { headers: ctx.headers }
  );
  const items = listed.files || [];
  ctx.listCache.set(parentId, items);
  return items;
}

function invalidateListCache(parentId, ctx) {
  if (ctx?.listCache) ctx.listCache.delete(parentId);
}

async function findChildByName(parentId, name, ctx, { folder = false } = {}) {
  const items = await listChildrenCached(parentId, ctx);
  const needle = String(name).toLowerCase();
  // If Drive already has duplicates, reuse the first match — never create another
  const match = items.find((item) => {
    const isFolder = Boolean(item.isFolder || item.mimeType === 'application/vnd.google-apps.folder');
    if (folder && !isFolder) return false;
    if (!folder && isFolder) return false;
    return String(item.name || '').toLowerCase() === needle;
  });
  return match || null;
}

async function ensureParentFolder(relPath, manifest, ctx, projectFolderId) {
  const parts = relPath.split('/').slice(0, -1);
  let parentId = projectFolderId;
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    if (manifest.folders[acc]) {
      parentId = manifest.folders[acc];
      continue;
    }
    // Reuse an existing Drive folder with the same name — never create duplicates
    const existing = await findChildByName(parentId, part, ctx, { folder: true });
    if (existing?.id) {
      parentId = existing.id;
      manifest.folders[acc] = parentId;
      continue;
    }
    try {
      const created = await driveRequest('POST', '/drive/files', {
        headers: ctx.headers,
        body: { parentFolderId: parentId, name: part, type: 'folder' },
      });
      invalidateListCache(parentId, ctx);
      parentId = created.id;
      manifest.folders[acc] = parentId;
    } catch (err) {
      if (err.status === 409) {
        invalidateListCache(parentId, ctx);
        const again = await findChildByName(parentId, part, ctx, { folder: true });
        if (again?.id) {
          parentId = again.id;
          manifest.folders[acc] = parentId;
          continue;
        }
      }
      throw err;
    }
  }
  return parentId;
}

/**
 * Ensure a folder path exists on Drive (including empty mkdir trees).
 * Looks up siblings by name before creating to avoid duplicate "s" folders.
 */
async function ensureFolderPath(relDir, manifest, ctx, projectFolderId) {
  if (!relDir || relDir === '.') return projectFolderId;
  const parts = relDir.split('/').filter(Boolean);
  let parentId = projectFolderId;
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    if (manifest.folders[acc]) {
      parentId = manifest.folders[acc];
      continue;
    }
    const existing = await findChildByName(parentId, part, ctx, { folder: true });
    if (existing?.id) {
      parentId = existing.id;
      manifest.folders[acc] = parentId;
      continue;
    }
    try {
      const created = await driveRequest('POST', '/drive/files', {
        headers: ctx.headers,
        body: { parentFolderId: parentId, name: part, type: 'folder' },
      });
      invalidateListCache(parentId, ctx);
      parentId = created.id;
      manifest.folders[acc] = parentId;
    } catch (err) {
      // Race: another push created it — adopt the existing folder
      if (err.status === 409) {
        invalidateListCache(parentId, ctx);
        const again = await findChildByName(parentId, part, ctx, { folder: true });
        if (again?.id) {
          parentId = again.id;
          manifest.folders[acc] = parentId;
          continue;
        }
      }
      throw err;
    }
  }
  return parentId;
}

/** Serialize pushes per workspace so parallel watchers can't mint duplicate folders */
const pushLocks = new Map();

/**
 * Push local workspace files (and empty folders) back to Drive.
 * Uses a promise-chain mutex (safe under concurrent awaiters).
 */
async function pushProject({ userId, projectFolderId, googleAccessToken, cwd }) {
  const root = cwd || projectRoot(userId, projectFolderId);
  if (!fs.existsSync(root)) {
    throw Object.assign(new Error('Local workspace not found'), { code: 'TERMINAL_SYNC_MISSING' });
  }

  let release;
  const myTurn = new Promise((resolve) => { release = resolve; });
  const prev = pushLocks.get(root) || Promise.resolve();
  const tail = prev.then(() => myTurn);
  pushLocks.set(root, tail);

  await prev;
  try {
    return await pushProjectUnlocked({ userId, projectFolderId, googleAccessToken, cwd: root });
  } finally {
    release();
    if (pushLocks.get(root) === tail) pushLocks.delete(root);
  }
}

async function pushProjectUnlocked({ userId, projectFolderId, googleAccessToken, cwd }) {
  const root = cwd;
  const serviceSecret = process.env.INTERNAL_SECRET || process.env.DRIVE_SERVICE_SECRET || '';
  const headers = buildHeaders({ userId, googleAccessToken, serviceSecret });
  const ctx = { headers };
  const manifest = readManifest(root);
  const folderId = projectFolderId || manifest.projectFolderId;
  if (!folderId) {
    throw Object.assign(new Error('projectFolderId missing for push'), { code: 'TERMINAL_SYNC_PARAMS' });
  }

  const localFiles = [];
  walkLocalFiles(root, root, localFiles);
  const localDirs = [];
  walkLocalDirs(root, root, localDirs);

  let updated = 0;
  let created = 0;
  let deleted = 0;
  let foldersCreated = 0;
  let skipped = 0;
  const conflicts = [];

  const localRelSet = new Set(localFiles.map((f) => f.rel));
  const localDirSet = new Set(localDirs.map((d) => d.rel));
  manifest.hashes = manifest.hashes || {};
  manifest.meta = manifest.meta || {};
  manifest.folders = manifest.folders || { '.': folderId };
  manifest.folders['.'] = folderId;

  // Create empty directories on Drive (mkdir that never got a file)
  for (const { rel } of localDirs) {
    if (manifest.folders[rel]) continue;
    try {
      const before = manifest.folders[rel];
      await ensureFolderPath(rel, manifest, ctx, folderId);
      if (!before && manifest.folders[rel]) foldersCreated += 1;
    } catch (err) {
      conflicts.push({ path: rel, reason: 'folder_create_failed', message: err.message });
    }
  }

  // Delete Drive files that exist in the manifest but were removed locally
  for (const [rel, fileId] of Object.entries(manifest.files || {})) {
    if (localRelSet.has(rel)) continue;
    if (!fileId) continue;
    try {
      await driveRequest('DELETE', `/drive/files/${encodeURIComponent(fileId)}`, {
        headers: ctx.headers,
      });
      delete manifest.files[rel];
      delete manifest.hashes[rel];
      delete manifest.meta[rel];
      if (manifest.remoteHashes) delete manifest.remoteHashes[rel];
      deleted += 1;
    } catch (err) {
      if (err.status === 404) {
        delete manifest.files[rel];
        delete manifest.hashes[rel];
        delete manifest.meta[rel];
        if (manifest.remoteHashes) delete manifest.remoteHashes[rel];
        deleted += 1;
      }
    }
  }

  // Delete Drive folders removed locally (deepest first)
  const manifestFolders = Object.keys(manifest.folders || {})
    .filter((rel) => rel && rel !== '.')
    .sort((a, b) => b.split('/').length - a.split('/').length);
  for (const rel of manifestFolders) {
    if (localDirSet.has(rel)) continue;
    const driveFolderId = manifest.folders[rel];
    if (!driveFolderId) continue;
    try {
      await driveRequest('DELETE', `/drive/files/${encodeURIComponent(driveFolderId)}`, {
        headers: ctx.headers,
      });
      delete manifest.folders[rel];
      deleted += 1;
    } catch (err) {
      if (err.status === 404) delete manifest.folders[rel];
    }
  }

  for (const { rel, full } of localFiles) {
    const buffer = fs.readFileSync(full);
    const hash = sha256(buffer);
    const binary = isProbablyBinary(rel, buffer);
    const existingId = manifest.files[rel];
    const prevHash = manifest.hashes[rel];

    if (existingId && prevHash && prevHash === hash) {
      skipped += 1;
      continue;
    }

    if (binary && buffer.length > MAX_BINARY_BYTES) {
      conflicts.push({ path: rel, reason: 'binary_too_large', size: buffer.length });
      continue;
    }

    const bodyContent = binary
      ? { content: buffer.toString('base64'), encoding: 'base64' }
      : { content: buffer.toString('utf8') };

    if (existingId) {
      // Conflict heuristic: local content changed since last sync AND Drive md5
      // (when known) still matches the md5 we last pulled — safe overwrite.
      // Never compare md5Checksum against local sha256 (different algorithms).
      const knownRemoteMd5 = manifest.remoteHashes?.[rel];
      if (
        prevHash
        && prevHash !== hash
        && knownRemoteMd5
        && process.env.TERMINAL_SYNC_CONFLICT_STRATEGY === 'skip'
      ) {
        // Without a fresh Drive md5 we can't prove remote divergence; skip only
        // when explicitly configured and we know local drifted from last sync.
        conflicts.push({
          path: rel,
          reason: 'local_modified_skip',
          localHash: hash,
          baseHash: prevHash,
          remoteMd5: knownRemoteMd5,
        });
        continue;
      }

      try {
        await driveRequest('PUT', `/drive/files/${encodeURIComponent(existingId)}/flush`, {
          headers: ctx.headers,
          body: bodyContent,
        });
        manifest.hashes[rel] = hash;
        // remoteHashes stores Drive MD5 only — clear until next pull refreshes it
        if (manifest.remoteHashes) delete manifest.remoteHashes[rel];
        manifest.meta[rel] = { binary, size: buffer.length };
        updated += 1;
      } catch (err) {
        conflicts.push({ path: rel, reason: 'push_failed', message: err.message });
      }
    } else {
      const parentId = await ensureParentFolder(rel, manifest, ctx, folderId);
      const name = path.basename(rel);
      try {
        const createdFile = await driveRequest('POST', '/drive/files', {
          headers: ctx.headers,
          body: {
            parentFolderId: parentId,
            name,
            type: 'file',
            ...bodyContent,
          },
        });
        invalidateListCache(parentId, ctx);
        manifest.files[rel] = createdFile.id;
        manifest.hashes[rel] = hash;
        if (manifest.remoteHashes) delete manifest.remoteHashes[rel];
        manifest.meta[rel] = { binary, size: buffer.length };
        created += 1;
      } catch (err) {
        if (err.status === 409) {
          // Same-name file already on Drive — adopt it and flush content
          invalidateListCache(parentId, ctx);
          const existing = await findChildByName(parentId, name, ctx, { folder: false });
          if (existing?.id) {
            try {
              await driveRequest('PUT', `/drive/files/${encodeURIComponent(existing.id)}/flush`, {
                headers: ctx.headers,
                body: bodyContent,
              });
              manifest.files[rel] = existing.id;
              manifest.hashes[rel] = hash;
              if (manifest.remoteHashes) delete manifest.remoteHashes[rel];
              manifest.meta[rel] = { binary, size: buffer.length };
              updated += 1;
            } catch (e2) {
              conflicts.push({ path: rel, reason: 'adopt_failed', message: e2.message });
            }
          } else {
            conflicts.push({ path: rel, reason: 'create_failed', message: err.message });
          }
        } else {
          conflicts.push({ path: rel, reason: 'create_failed', message: err.message });
        }
      }
    }
  }

  manifest.version = 2;
  manifest.syncedAt = new Date().toISOString();
  manifest.projectFolderId = folderId;
  writeManifest(root, manifest);

  return {
    updated,
    created,
    deleted,
    foldersCreated,
    skipped,
    conflicts,
    fileCount: localFiles.length,
    folderCount: localDirs.length,
    cwd: root,
  };
}

/** Active fs watchers for auto-push (cwd → handle) */
const autoPushWatchers = new Map();

function stopAutoPush(cwd) {
  const entry = autoPushWatchers.get(cwd);
  if (!entry) return;
  try { entry.watcher.close(); } catch { /* ignore */ }
  if (entry.timer) clearTimeout(entry.timer);
  if (entry.poll) clearInterval(entry.poll);
  autoPushWatchers.delete(cwd);
}

/** Cheap fingerprint of the workspace tree — poll mode skips push when unchanged. */
function workspaceFingerprint(root) {
  const parts = [];
  const walk = (dir) => {
    let names;
    try { names = fs.readdirSync(dir); } catch { return; }
    for (const name of names.sort()) {
      if (SKIP_NAMES.has(name) || name === MANIFEST_NAME) continue;
      const full = path.join(dir, name);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      const rel = path.relative(root, full).replace(/\\/g, '/');
      parts.push(`${rel}:${st.mtimeMs}:${st.size}:${st.isDirectory() ? 'd' : 'f'}`);
      if (st.isDirectory()) walk(full);
    }
  };
  walk(root);
  return parts.join('|');
}

/**
 * Watch a local workspace and debounce-push changes to Drive.
 * Covers mkdir/touch/rm from the PTY without requiring a manual Sync click.
 */
function startAutoPush({ userId, projectFolderId, googleAccessToken, cwd }) {
  const root = cwd || projectRoot(userId, projectFolderId);
  stopAutoPush(root);
  if (!fs.existsSync(root) || !googleAccessToken || !projectFolderId) return;

  const pushOpts = { userId, projectFolderId, googleAccessToken, cwd: root };
  let timer = null;
  let pushing = false;
  let pending = false;

  const entry = {
    watcher: null,
    timer: null,
    poll: null,
    schedule: null,
    quietUntil: 0,
    lastFingerprint: workspaceFingerprint(root),
  };

  const runPush = async () => {
    if (Date.now() < (entry.quietUntil || 0)) return;
    if (pushing) { pending = true; return; }
    const fp = workspaceFingerprint(root);
    if (fp === entry.lastFingerprint) return;
    pushing = true;
    try {
      // Refresh Google token so long-lived terminals don't fail after ~55m
      const fresh = await resolveFreshGoogleToken(userId, pushOpts.googleAccessToken);
      if (fresh) pushOpts.googleAccessToken = fresh;

      const result = await pushProject(pushOpts);
      entry.lastFingerprint = workspaceFingerprint(root);
      if (result.created || result.updated || result.deleted || result.foldersCreated) {
        console.log(
          `[terminal-sync] auto-push ${root}: +${result.created} ~${result.updated} -${result.deleted} dirs:${result.foldersCreated}`
        );
      }
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        const fresh = await resolveFreshGoogleToken(userId, null);
        if (fresh && fresh !== pushOpts.googleAccessToken) {
          pushOpts.googleAccessToken = fresh;
          try {
            await pushProject(pushOpts);
            entry.lastFingerprint = workspaceFingerprint(root);
            console.log(`[terminal-sync] auto-push recovered after token refresh`);
            return;
          } catch (err2) {
            console.warn(`[terminal-sync] auto-push failed after token refresh: ${err2.message}`);
            return;
          }
        }
      }
      console.warn(`[terminal-sync] auto-push failed: ${err.message}`);
    } finally {
      pushing = false;
      if (pending) {
        pending = false;
        timer = setTimeout(runPush, 1200);
        entry.timer = timer;
      }
    }
  };

  const schedule = () => {
    if (Date.now() < (entry.quietUntil || 0)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(runPush, 3500);
    entry.timer = timer;
  };

  entry.schedule = schedule;

  try {
    entry.watcher = fs.watch(root, { recursive: true }, (_evt, filename) => {
      const name = filename ? String(filename).replace(/\\/g, '/') : '';
      if (name.includes(MANIFEST_NAME)) return;
      schedule();
    });
  } catch (err) {
    console.warn(`[terminal-sync] recursive watch unavailable (${err.message}); polling for changes`);
    entry.poll = setInterval(() => {
      try {
        if (workspaceFingerprint(root) !== entry.lastFingerprint) schedule();
      } catch { /* ignore */ }
    }, 5000);
  }

  autoPushWatchers.set(root, entry);
  // Quiet startup — first push after a real local change (or manual Sync).
  entry.timer = timer;
}

/**
 * After a Drive→disk pull, suppress auto-push briefly and accept the new
 * fingerprint so pull writes don't bounce stale disk content back to Drive.
 */
function quietAutoPushAfterPull(cwd, ms = 6000) {
  if (!cwd) return;
  const entry = autoPushWatchers.get(cwd);
  if (!entry) return;
  try {
    entry.lastFingerprint = workspaceFingerprint(cwd);
  } catch { /* ignore */ }
  entry.quietUntil = Date.now() + ms;
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
}

/**
 * Remove local files that no longer exist on Drive (after an IDE/Drive delete).
 * Keeps the PTY workspace consistent so auto-push won't resurrect deleted files.
 */
function pruneLocalAgainstManifest(root, keepFiles, keepFolders) {
  if (!fs.existsSync(root)) return { pruned: 0 };
  let pruned = 0;

  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      if (SKIP_NAMES.has(name)) continue;
      const full = path.join(dir, name);
      const rel = path.relative(root, full).replace(/\\/g, '/');
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        walk(full);
        if (!keepFolders.has(rel) && rel !== '') {
          try {
            // Only remove if empty after child prune
            if (fs.readdirSync(full).filter((n) => !SKIP_NAMES.has(n)).length === 0) {
              fs.rmdirSync(full);
              pruned += 1;
            }
          } catch { /* ignore */ }
        }
      } else if (st.isFile() && !keepFiles.has(rel)) {
        try {
          fs.unlinkSync(full);
          pruned += 1;
        } catch { /* ignore */ }
      }
    }
  };
  walk(root);
  return { pruned };
}

module.exports = {
  WORKSPACE_ROOT,
  projectRoot,
  pullProject,
  pushProject,
  sanitizeId,
  ensureWorkspaceRoot,
  startAutoPush,
  stopAutoPush,
  quietAutoPushAfterPull,
  pruneLocalAgainstManifest,
  resolveFreshGoogleToken,
  _setDriveRequestForTests,
};
