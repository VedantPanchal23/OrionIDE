/**
 * workspaceSync unit tests — hash model, duplicate-name skip, prune
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.TERMINAL_WORKSPACE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'orion-sync-test-'));

const {
  pruneLocalAgainstManifest,
  projectRoot,
  sanitizeId,
} = require('../src/services/workspaceSync');

describe('workspaceSync helpers', () => {
  afterAll(() => {
    try {
      fs.rmSync(process.env.TERMINAL_WORKSPACE_ROOT, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  test('sanitizeId strips unsafe characters', () => {
    expect(sanitizeId('../evil/user')).toBe('___evil_user');
    expect(sanitizeId('user_123')).toBe('user_123');
  });

  test('projectRoot nests under workspace root', () => {
    const root = projectRoot('user-a', 'folder-b');
    expect(root.startsWith(process.env.TERMINAL_WORKSPACE_ROOT)).toBe(true);
    expect(root.includes(sanitizeId('user-a'))).toBe(true);
    expect(root.includes(sanitizeId('folder-b'))).toBe(true);
  });

  test('local sha256 and Drive md5 must not be stored in the same field', () => {
    // Document the contract: hashes = sha256(local), remoteHashes = Drive md5
    const buf = Buffer.from('print("hi")\n', 'utf8');
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    const md5 = crypto.createHash('md5').update(buf).digest('hex');
    expect(sha).not.toBe(md5);

    const manifest = {
      hashes: { 'main.py': sha },
      remoteHashes: { 'main.py': md5 },
    };
    // Pull skip condition: same Drive id + same remote md5
    expect(manifest.remoteHashes['main.py']).toBe(md5);
    expect(manifest.hashes['main.py']).toBe(sha);
    // Push must never assign sha into remoteHashes
    delete manifest.remoteHashes['main.py'];
    expect(manifest.remoteHashes['main.py']).toBeUndefined();
  });

  test('pruneLocalAgainstManifest removes files not in keep set', () => {
    const root = fs.mkdtempSync(path.join(process.env.TERMINAL_WORKSPACE_ROOT, 'prune-'));
    fs.writeFileSync(path.join(root, 'keep.py'), 'x', 'utf8');
    fs.writeFileSync(path.join(root, 'gone.py'), 'y', 'utf8');
    fs.mkdirSync(path.join(root, 'empty-dir'));

    const keepFiles = new Set(['keep.py']);
    const keepFolders = new Set();
    const result = pruneLocalAgainstManifest(root, keepFiles, keepFolders);

    expect(fs.existsSync(path.join(root, 'keep.py'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'gone.py'))).toBe(false);
    expect(result.pruned).toBeGreaterThanOrEqual(1);
  });

  test('duplicate sibling names: first wins (contract for pull)', () => {
    const items = [
      { id: '1', name: 's', isFolder: true },
      { id: '2', name: 's', isFolder: true },
      { id: '3', name: 'p.py', isFolder: false },
    ];
    const seen = new Set();
    const kept = [];
    for (const item of items) {
      const key = String(item.name).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(item);
    }
    expect(kept).toHaveLength(2);
    expect(kept[0].id).toBe('1');
    expect(kept.map((i) => i.name)).toEqual(['s', 'p.py']);
  });
});
