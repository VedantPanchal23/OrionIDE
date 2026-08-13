/**
 * workspaceSync push/pull with mocked Drive HTTP
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.TERMINAL_WORKSPACE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'orion-sync-mock-'));
process.env.INTERNAL_SECRET = 'test-secret';

const {
  pullProject,
  pushProject,
  projectRoot,
  _setDriveRequestForTests,
  pruneLocalAgainstManifest,
  sanitizeId,
} = require('../src/services/workspaceSync');

describe('workspaceSync push/pull (mocked Drive)', () => {
  const userId = 'user-sync-1';
  const projectFolderId = 'proj-folder-1';
  let driveState;

  beforeEach(() => {
    driveState = {
      folders: {
        [projectFolderId]: { id: projectFolderId, name: 'Project', children: [] },
      },
      files: {},
      nextId: 100,
    };

    _setDriveRequestForTests(async (method, urlPath, opts = {}) => {
      const body = opts.body || {};

      // LIST children
      const listMatch = urlPath.match(/^\/drive\/files\?folderId=([^&]+)/);
      if (method === 'GET' && listMatch) {
        const folderId = decodeURIComponent(listMatch[1]);
        const folder = driveState.folders[folderId];
        const children = (folder?.children || []).map((id) => {
          if (driveState.folders[id]) {
            return {
              id,
              name: driveState.folders[id].name,
              isFolder: true,
              mimeType: 'application/vnd.google-apps.folder',
            };
          }
          const f = driveState.files[id];
          return {
            id,
            name: f.name,
            isFolder: false,
            mimeType: 'text/plain',
            md5Checksum: f.md5,
          };
        });
        return { files: children };
      }

      // READ file
      const readMatch = urlPath.match(/^\/drive\/files\/([^/?]+)(?:\?asBinary=1)?$/);
      if (method === 'GET' && readMatch && !urlPath.includes('folderId')) {
        const id = decodeURIComponent(readMatch[1]);
        const f = driveState.files[id];
        if (!f) {
          const err = new Error('not found');
          err.status = 404;
          throw err;
        }
        return {
          content: Buffer.from(f.content).toString('base64'),
          encoding: 'base64',
          size: f.content.length,
        };
      }

      // CREATE file/folder
      if (method === 'POST' && urlPath === '/drive/files') {
        const parent = driveState.folders[body.parentFolderId];
        if (!parent) throw Object.assign(new Error('parent missing'), { status: 404 });
        const name = body.name;
        const exists = parent.children.some((cid) => {
          const n = driveState.folders[cid]?.name || driveState.files[cid]?.name;
          return n && n.toLowerCase() === String(name).toLowerCase();
        });
        if (exists) throw Object.assign(new Error('exists'), { status: 409 });

        const id = `id-${driveState.nextId++}`;
        if (body.type === 'folder') {
          driveState.folders[id] = { id, name, children: [] };
          parent.children.push(id);
          return { id, name, isFolder: true };
        }
        const content = body.encoding === 'base64'
          ? Buffer.from(body.content || '', 'base64')
          : Buffer.from(body.content || '', 'utf8');
        const md5 = crypto.createHash('md5').update(content).digest('hex');
        driveState.files[id] = { id, name, content, md5, parentId: body.parentFolderId };
        parent.children.push(id);
        return { id, name };
      }

      // FLUSH / update
      const flushMatch = urlPath.match(/^\/drive\/files\/([^/]+)\/flush$/);
      if (method === 'PUT' && flushMatch) {
        const id = decodeURIComponent(flushMatch[1]);
        const f = driveState.files[id];
        if (!f) throw Object.assign(new Error('not found'), { status: 404 });
        const content = body.encoding === 'base64'
          ? Buffer.from(body.content || '', 'base64')
          : Buffer.from(body.content || '', 'utf8');
        f.content = content;
        f.md5 = crypto.createHash('md5').update(content).digest('hex');
        return { id, modifiedTime: new Date().toISOString() };
      }

      // DELETE
      const delMatch = urlPath.match(/^\/drive\/files\/([^/?]+)$/);
      if (method === 'DELETE' && delMatch) {
        const id = decodeURIComponent(delMatch[1]);
        delete driveState.files[id];
        delete driveState.folders[id];
        Object.values(driveState.folders).forEach((folder) => {
          folder.children = folder.children.filter((c) => c !== id);
        });
        return { success: true };
      }

      throw new Error(`Unhandled mock Drive ${method} ${urlPath}`);
    });
  });

  afterEach(() => {
    _setDriveRequestForTests(null);
    const root = projectRoot(userId, projectFolderId);
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  afterAll(() => {
    try {
      fs.rmSync(process.env.TERMINAL_WORKSPACE_ROOT, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  test('pullProject writes Drive files locally and stores hashes', async () => {
    const fileId = 'file-main';
    const content = Buffer.from('print("hello")\n', 'utf8');
    driveState.files[fileId] = {
      id: fileId,
      name: 'main.py',
      content,
      md5: crypto.createHash('md5').update(content).digest('hex'),
      parentId: projectFolderId,
    };
    driveState.folders[projectFolderId].children.push(fileId);

    const result = await pullProject({
      userId,
      projectFolderId,
      googleAccessToken: 'ya29.test',
    });

    expect(result.cwd).toBe(projectRoot(userId, projectFolderId));
    expect(fs.readFileSync(path.join(result.cwd, 'main.py'), 'utf8')).toBe('print("hello")\n');

    const manifest = JSON.parse(fs.readFileSync(path.join(result.cwd, '.orion-sync.json'), 'utf8'));
    expect(manifest.files['main.py']).toBe(fileId);
    expect(manifest.hashes['main.py']).toBe(crypto.createHash('sha256').update(content).digest('hex'));
    expect(manifest.remoteHashes['main.py']).toBe(driveState.files[fileId].md5);
    expect(manifest.hashes['main.py']).not.toBe(manifest.remoteHashes['main.py']);
  });

  test('pullProject skips duplicate sibling folder names', async () => {
    driveState.folders['dup-a'] = { id: 'dup-a', name: 's', children: [] };
    driveState.folders['dup-b'] = { id: 'dup-b', name: 's', children: [] };
    driveState.folders[projectFolderId].children.push('dup-a', 'dup-b');

    const result = await pullProject({
      userId,
      projectFolderId,
      googleAccessToken: 'ya29.test',
    });

    expect(fs.existsSync(path.join(result.cwd, 's'))).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.join(result.cwd, '.orion-sync.json'), 'utf8'));
    expect(manifest.folders.s).toBe('dup-a');
  });

  test('pushProject creates folders/files and does not store sha in remoteHashes', async () => {
    const root = projectRoot(userId, projectFolderId);
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'app.py'), 'x = 1\n', 'utf8');

    const result = await pushProject({
      userId,
      projectFolderId,
      googleAccessToken: 'ya29.test',
      cwd: root,
    });

    expect(result.created).toBeGreaterThanOrEqual(1);
    expect(result.foldersCreated).toBeGreaterThanOrEqual(1);

    const manifest = JSON.parse(fs.readFileSync(path.join(root, '.orion-sync.json'), 'utf8'));
    expect(manifest.files['src/app.py']).toBeDefined();
    expect(manifest.hashes['src/app.py']).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.remoteHashes?.['src/app.py']).toBeUndefined();

    // Second push with no changes should skip
    const again = await pushProject({
      userId,
      projectFolderId,
      googleAccessToken: 'ya29.test',
      cwd: root,
    });
    expect(again.created).toBe(0);
    expect(again.updated).toBe(0);
    expect(again.skipped).toBeGreaterThanOrEqual(1);
  });

  test('pushProject reuses existing same-name folder (no duplicates)', async () => {
    const existingId = 'existing-s';
    driveState.folders[existingId] = { id: existingId, name: 's', children: [] };
    driveState.folders[projectFolderId].children.push(existingId);

    const root = projectRoot(userId, projectFolderId);
    fs.mkdirSync(path.join(root, 's'), { recursive: true });
    fs.writeFileSync(path.join(root, 's', 'p.py'), 'print(1)\n', 'utf8');

    await pushProject({
      userId,
      projectFolderId,
      googleAccessToken: 'ya29.test',
      cwd: root,
    });

    const sFolders = Object.values(driveState.folders).filter((f) => f.name === 's');
    expect(sFolders).toHaveLength(1);
    expect(sFolders[0].id).toBe(existingId);
  });

  test('sanitizeId + prune still work', () => {
    expect(sanitizeId('a/b')).toBe('a_b');
    const root = fs.mkdtempSync(path.join(process.env.TERMINAL_WORKSPACE_ROOT, 'p-'));
    fs.writeFileSync(path.join(root, 'a.txt'), '1');
    fs.writeFileSync(path.join(root, 'b.txt'), '2');
    const { pruned } = pruneLocalAgainstManifest(root, new Set(['a.txt']), new Set());
    expect(pruned).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(path.join(root, 'a.txt'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'b.txt'))).toBe(false);
  });
});
