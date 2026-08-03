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
    () => driveRequestOnce(method, urlPath, opts),
    {
      retries: Number(process.env.TERMINAL_SYNC_RETRIES) || 4,
      baseMs: 400,
      maxMs: 10000,
    }
  );
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

  for (const item of items) {
    if (!item?.name || SKIP_NAMES.has(item.name)) continue;
    if (counters.files >= MAX_FILES) {
      throw Object.assign(new Error(`Sync file limit exceeded (${MAX_FILES})`), { code: 'TERMINAL_SYNC_LIMIT' });
    }

    const rel = relBase ? path.join(relBase, item.name) : item.name;
    const relKey = rel.replace(/\\/g, '/');
    const target = path.join(localDir, item.name);

    if (item.isFolder || item.mimeType === 'application/vnd.google-apps.folder') {
      await pullFolder(item.id, target, ctx, depth + 1, counters, manifest, rel);
      continue;
    }

    // Resume: skip if already pulled with same Drive id and local file exists
    if (
      manifest.files[relKey] === item.id
      && fs.existsSync(target)
      && (!item.md5Checksum || manifest.remoteHashes?.[relKey] === item.md5Checksum)
    ) {
      counters.skipped = (counters.skipped || 0) + 1;
      continue;
    }

    const contentData = await driveRequest('GET', `/drive/files/${encodeURIComponent(item.id)}`, {
      headers: ctx.headers,
    });
    let content = typeof contentData.content === 'string'
      ? contentData.content
      : (contentData.content ?? '');

    // Drive service returns text today; support base64 binary payloads when present
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

  await pullFolder(projectFolderId, root, ctx, 0, counters, manifest, '');
  writeManifest(root, manifest);

  return {
    cwd: root,
    fileCount: counters.files,
    skipped: counters.skipped || 0,
    skippedBinary: counters.skippedBinary || 0,
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
    const created = await driveRequest('POST', '/drive/files', {
      headers: ctx.headers,
      body: { parentFolderId: parentId, name: part, type: 'folder' },
    });
    parentId = created.id;
    manifest.folders[acc] = parentId;
  }
  return parentId;
}

/**
 * Push local workspace files back to Drive using the sync manifest.
 */
async function pushProject({ userId, projectFolderId, googleAccessToken, cwd }) {
  const root = cwd || projectRoot(userId, projectFolderId);
  if (!fs.existsSync(root)) {
    throw Object.assign(new Error('Local workspace not found'), { code: 'TERMINAL_SYNC_MISSING' });
  }

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

  let updated = 0;
  let created = 0;
  let deleted = 0;
  let skipped = 0;
  const conflicts = [];

  const localRelSet = new Set(localFiles.map((f) => f.rel));
  manifest.hashes = manifest.hashes || {};
  manifest.meta = manifest.meta || {};

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

  for (const { rel, full } of localFiles) {
    const buffer = fs.readFileSync(full);
    const hash = sha256(buffer);
    const binary = isProbablyBinary(rel, buffer);
    const existingId = manifest.files[rel];
    const prevHash = manifest.hashes[rel];

    // Unchanged since last sync — skip
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
      // Conflict-aware: if Drive copy hash diverged and local also changed, record conflict
      // (Drive service doesn't return hash yet — we detect via optional remoteHash in manifest)
      if (manifest.remoteHashes?.[rel] && manifest.remoteHashes[rel] !== prevHash && prevHash !== hash) {
        conflicts.push({
          path: rel,
          reason: 'both_modified',
          localHash: hash,
          baseHash: prevHash,
          remoteHash: manifest.remoteHashes[rel],
        });
        // Keep local; still push (last-write-wins) unless conflictStrategy=skip
        if (process.env.TERMINAL_SYNC_CONFLICT_STRATEGY === 'skip') {
          continue;
        }
      }

      try {
        await driveRequest('PUT', `/drive/files/${encodeURIComponent(existingId)}/flush`, {
          headers: ctx.headers,
          body: bodyContent,
        });
        manifest.hashes[rel] = hash;
        manifest.remoteHashes = manifest.remoteHashes || {};
        manifest.remoteHashes[rel] = hash;
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
        manifest.files[rel] = createdFile.id;
        manifest.hashes[rel] = hash;
        manifest.remoteHashes = manifest.remoteHashes || {};
        manifest.remoteHashes[rel] = hash;
        manifest.meta[rel] = { binary, size: buffer.length };
        created += 1;
      } catch (err) {
        conflicts.push({ path: rel, reason: 'create_failed', message: err.message });
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
    skipped,
    conflicts,
    fileCount: localFiles.length,
    cwd: root,
  };
}

module.exports = {
  WORKSPACE_ROOT,
  projectRoot,
  pullProject,
  pushProject,
  sanitizeId,
  ensureWorkspaceRoot,
};
