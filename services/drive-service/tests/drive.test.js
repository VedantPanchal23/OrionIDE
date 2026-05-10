/**
 * Orion IDE — Drive Service Tests
 *
 * Test suites:
 *   1. Drive Client: creates authenticated client, MIME type detection
 *   2. Folder Service: ensureOrionFolder, ensurePath, createFolder, listFolder
 *   3. File Service: createFile, readFile, updateFile, deleteFile, renameFile
 *   4. Write Buffer: addToBuffer, flushImmediate
 *   5. Routes: standard response formats, parameter validation
 */

const request = require('supertest');

// Mock googleapis before any requires
jest.mock('googleapis', () => {
  const mockDrive = {
    files: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
    },
  };

  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          setCredentials: jest.fn(),
        })),
      },
      drive: jest.fn(() => mockDrive),
      _mockDrive: mockDrive,
    },
  };
});

// Mock Redis
jest.mock('../src/services/redisClient', () => {
  const store = new Map();
  const mockRedis = {
    get: jest.fn((key) => Promise.resolve(store.get(key) || null)),
    set: jest.fn((key, value, opts) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: jest.fn((key) => {
      if (Array.isArray(key)) {
        key.forEach((k) => store.delete(k));
      } else {
        store.delete(key);
      }
      return Promise.resolve(1);
    }),
    exists: jest.fn((key) => Promise.resolve(store.has(key) ? 1 : 0)),
    scan: jest.fn(() => Promise.resolve({ cursor: 0, keys: [] })),
    isOpen: true,
  };

  return {
    getRedisClient: jest.fn(() => Promise.resolve(mockRedis)),
    closeRedisClient: jest.fn(),
    _mockRedis: mockRedis,
    _store: store,
  };
});

// Set test environment
process.env.NODE_ENV = 'test';

const { google } = require('googleapis');
const { createDriveClient, getMimeType, MIME_TYPES } = require('../src/services/driveClient');
const { ensureOrionFolder, listFolder, createFolder, ensurePath } = require('../src/services/folderService');
const { createFile, readFile, updateFile, deleteFile, renameFile, getMetadata } = require('../src/services/fileService');
const { addToBuffer, BUFFER_PREFIX } = require('../src/services/writeBuffer');
const { _mockRedis, _store } = require('../src/services/redisClient');

const app = require('../src/app');

// Get the mock drive instance
const mockDrive = google._mockDrive;

// ─────────────────────────────────────────────────────────────────────────
// 1. DRIVE CLIENT
// ─────────────────────────────────────────────────────────────────────────
describe('Drive Client', () => {
  test('createDriveClient creates an authenticated client', () => {
    const client = createDriveClient('test-access-token');
    expect(client).toBeDefined();
    expect(google.drive).toHaveBeenCalledWith({ version: 'v3', auth: expect.any(Object) });
  });

  test('createDriveClient throws without access token', () => {
    expect(() => createDriveClient(null)).toThrow('Google access token is required');
    expect(() => createDriveClient('')).toThrow('Google access token is required');
  });

  test('getMimeType detects JavaScript files', () => {
    expect(getMimeType('app.js')).toBe(MIME_TYPES.JAVASCRIPT);
    expect(getMimeType('Component.jsx')).toBe(MIME_TYPES.JAVASCRIPT);
    expect(getMimeType('index.ts')).toBe(MIME_TYPES.JAVASCRIPT);
  });

  test('getMimeType detects HTML/CSS files', () => {
    expect(getMimeType('index.html')).toBe(MIME_TYPES.HTML);
    expect(getMimeType('styles.css')).toBe(MIME_TYPES.CSS);
  });

  test('getMimeType defaults to plain text for unknown extensions', () => {
    expect(getMimeType('Makefile')).toBe(MIME_TYPES.PLAIN_TEXT);
    expect(getMimeType('readme.txt')).toBe(MIME_TYPES.PLAIN_TEXT);
    expect(getMimeType('script.py')).toBe(MIME_TYPES.PLAIN_TEXT);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. FOLDER SERVICE
// ─────────────────────────────────────────────────────────────────────────
describe('Folder Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _store.clear();
  });

  test('ensureOrionFolder creates folder on first call', async () => {
    // No existing folder found
    mockDrive.files.list.mockResolvedValueOnce({
      data: { files: [] },
    });

    // Create folder
    mockDrive.files.create.mockResolvedValueOnce({
      data: { id: 'folder-abc', name: 'OrionIDE' },
    });

    const folderId = await ensureOrionFolder(mockDrive, 'user-1');
    expect(folderId).toBe('folder-abc');
    expect(mockDrive.files.create).toHaveBeenCalled();
  });

  test('ensureOrionFolder returns cached ID on second call', async () => {
    // Pre-populate cache
    _store.set('drive:user-2:rootFolderId', 'cached-folder-id');

    const folderId = await ensureOrionFolder(mockDrive, 'user-2');
    expect(folderId).toBe('cached-folder-id');
    // Drive API should NOT have been called
    expect(mockDrive.files.list).not.toHaveBeenCalled();
  });

  test('ensureOrionFolder finds existing folder in Drive', async () => {
    mockDrive.files.list.mockResolvedValueOnce({
      data: { files: [{ id: 'existing-folder-id', name: 'OrionIDE' }] },
    });

    const folderId = await ensureOrionFolder(mockDrive, 'user-3');
    expect(folderId).toBe('existing-folder-id');
    expect(mockDrive.files.create).not.toHaveBeenCalled();
  });

  test('listFolder returns formatted file list', async () => {
    mockDrive.files.list.mockResolvedValueOnce({
      data: {
        files: [
          { id: 'f1', name: 'src', mimeType: MIME_TYPES.FOLDER, modifiedTime: '2024-01-01', size: null, parents: ['root'] },
          { id: 'f2', name: 'index.js', mimeType: 'text/plain', modifiedTime: '2024-01-01', size: '100', parents: ['root'] },
        ],
      },
    });

    const items = await listFolder(mockDrive, 'root');
    expect(items).toHaveLength(2);
    expect(items[0].isFolder).toBe(true);
    expect(items[1].isFolder).toBe(false);
    expect(items[1].size).toBe(100);
  });

  test('createFolder creates a folder in Drive', async () => {
    mockDrive.files.create.mockResolvedValueOnce({
      data: { id: 'new-folder-id', name: 'components' },
    });

    const result = await createFolder(mockDrive, 'parent-id', 'components');
    expect(result.id).toBe('new-folder-id');
    expect(result.name).toBe('components');
  });

  test('ensurePath creates nested folders correctly', async () => {
    // First segment: 'src' — not found, create
    mockDrive.files.list.mockResolvedValueOnce({ data: { files: [] } });
    mockDrive.files.create.mockResolvedValueOnce({
      data: { id: 'src-id', name: 'src' },
    });

    // Second segment: 'components' — not found, create
    mockDrive.files.list.mockResolvedValueOnce({ data: { files: [] } });
    mockDrive.files.create.mockResolvedValueOnce({
      data: { id: 'components-id', name: 'components' },
    });

    const finalId = await ensurePath(mockDrive, 'root-id', 'src/components');
    expect(finalId).toBe('components-id');
    expect(mockDrive.files.create).toHaveBeenCalledTimes(2);
  });

  test('ensurePath reuses existing folders', async () => {
    // 'src' exists
    mockDrive.files.list.mockResolvedValueOnce({
      data: { files: [{ id: 'existing-src-id', name: 'src' }] },
    });

    // 'utils' does not exist
    mockDrive.files.list.mockResolvedValueOnce({ data: { files: [] } });
    mockDrive.files.create.mockResolvedValueOnce({
      data: { id: 'new-utils-id', name: 'utils' },
    });

    const finalId = await ensurePath(mockDrive, 'root-id', 'src/utils');
    expect(finalId).toBe('new-utils-id');
    expect(mockDrive.files.create).toHaveBeenCalledTimes(1); // Only 'utils' created
  });

  test('ensurePath returns rootFolderId for empty path', async () => {
    const id = await ensurePath(mockDrive, 'root-id', '');
    expect(id).toBe('root-id');

    const id2 = await ensurePath(mockDrive, 'root-id', '/');
    expect(id2).toBe('root-id');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. FILE SERVICE
// ─────────────────────────────────────────────────────────────────────────
describe('File Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createFile creates file in Drive', async () => {
    mockDrive.files.create.mockResolvedValueOnce({
      data: { id: 'file-1', name: 'app.js', webViewLink: 'https://drive.google.com/file-1', modifiedTime: '2024-01-01' },
    });

    const result = await createFile(mockDrive, 'parent-id', 'app.js', 'console.log("hi")');
    expect(result.id).toBe('file-1');
    expect(result.name).toBe('app.js');
    expect(result.webViewLink).toBeDefined();
  });

  test('readFile returns content as string', async () => {
    mockDrive.files.get.mockResolvedValueOnce({
      data: 'console.log("hello world")',
    });

    const content = await readFile(mockDrive, 'file-1');
    expect(content).toBe('console.log("hello world")');
  });

  test('updateFile updates file content', async () => {
    mockDrive.files.update.mockResolvedValueOnce({
      data: { id: 'file-1', modifiedTime: '2024-01-02' },
    });

    const result = await updateFile(mockDrive, 'file-1', 'updated content');
    expect(result.id).toBe('file-1');
    expect(result.modifiedTime).toBe('2024-01-02');
  });

  test('deleteFile trashes the file', async () => {
    mockDrive.files.update.mockResolvedValueOnce({ data: {} });

    const result = await deleteFile(mockDrive, 'file-1');
    expect(result.success).toBe(true);
    expect(mockDrive.files.update).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: 'file-1',
        requestBody: { trashed: true },
      })
    );
  });

  test('renameFile updates file name', async () => {
    mockDrive.files.update.mockResolvedValueOnce({
      data: { id: 'file-1', name: 'newName.js' },
    });

    const result = await renameFile(mockDrive, 'file-1', 'newName.js');
    expect(result.name).toBe('newName.js');
  });

  test('getMetadata returns formatted metadata', async () => {
    mockDrive.files.get.mockResolvedValueOnce({
      data: {
        id: 'file-1', name: 'app.js', mimeType: 'text/plain',
        parents: ['parent-id'], modifiedTime: '2024-01-01', size: '256',
        webViewLink: 'https://drive.google.com/file-1',
      },
    });

    const meta = await getMetadata(mockDrive, 'file-1');
    expect(meta.id).toBe('file-1');
    expect(meta.size).toBe(256);
    expect(meta.parents).toEqual(['parent-id']);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. WRITE BUFFER
// ─────────────────────────────────────────────────────────────────────────
describe('Write Buffer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _store.clear();
  });

  test('addToBuffer stores content in Redis', async () => {
    await addToBuffer('user-1', 'file-1', 'buffered content', 'google-token');

    expect(_mockRedis.set).toHaveBeenCalledWith(
      'drive:buffer:user-1:file-1',
      'buffered content',
      expect.objectContaining({ EX: expect.any(Number) })
    );
  });

  test('addToBuffer also stores the google access token', async () => {
    await addToBuffer('user-1', 'file-1', 'content', 'my-google-token');

    expect(_mockRedis.set).toHaveBeenCalledWith(
      'drive:token:user-1',
      'my-google-token',
      expect.objectContaining({ EX: expect.any(Number) })
    );
  });

  test('multiple addToBuffer calls overwrite previous content', async () => {
    await addToBuffer('user-1', 'file-1', 'version 1', 'token');
    await addToBuffer('user-1', 'file-1', 'version 2', 'token');

    // The store should have the latest value
    const stored = _store.get('drive:buffer:user-1:file-1');
    expect(stored).toBe('version 2');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 5. ROUTES — Response Format & Validation
// ─────────────────────────────────────────────────────────────────────────
describe('Drive Routes — Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _store.clear();
  });

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('drive-service');
  });

  test('routes require user context (X-User-Id header)', async () => {
    const res = await request(app)
      .get('/drive/projects')
      .expect(401);

    expect(res.body.error.code).toBe('DRIVE_NO_AUTH');
  });

  test('GET /drive/files requires folderId query param', async () => {
    // Set up mock Drive response for ensureOrionFolder
    mockDrive.files.list.mockResolvedValueOnce({ data: { files: [] } });

    const res = await request(app)
      .get('/drive/files')
      .set('X-User-Id', 'user-1')
      .set('X-Google-Access-Token', 'test-token')
      .expect(400);

    expect(res.body.error.code).toBe('DRIVE_MISSING_PARAM');
  });

  test('POST /drive/files requires parentFolderId and name', async () => {
    const res = await request(app)
      .post('/drive/files')
      .set('X-User-Id', 'user-1')
      .set('X-Google-Access-Token', 'test-token')
      .send({})
      .expect(400);

    expect(res.body.error.code).toBe('DRIVE_MISSING_PARAM');
  });

  test('PUT /drive/files/:id requires content', async () => {
    const res = await request(app)
      .put('/drive/files/file-1')
      .set('X-User-Id', 'user-1')
      .set('X-Google-Access-Token', 'test-token')
      .send({})
      .expect(400);

    expect(res.body.error.code).toBe('DRIVE_MISSING_PARAM');
  });

  test('PATCH /drive/files/:id/rename requires newName', async () => {
    const res = await request(app)
      .patch('/drive/files/file-1/rename')
      .set('X-User-Id', 'user-1')
      .set('X-Google-Access-Token', 'test-token')
      .send({})
      .expect(400);

    expect(res.body.error.code).toBe('DRIVE_MISSING_PARAM');
  });

  test('POST /drive/ensure-path requires rootFolderId and path', async () => {
    const res = await request(app)
      .post('/drive/ensure-path')
      .set('X-User-Id', 'user-1')
      .set('X-Google-Access-Token', 'test-token')
      .send({})
      .expect(400);

    expect(res.body.error.code).toBe('DRIVE_MISSING_PARAM');
  });

  test('PUT /drive/files/:id buffers content (success response)', async () => {
    const res = await request(app)
      .put('/drive/files/file-abc')
      .set('X-User-Id', 'user-1')
      .set('X-Google-Access-Token', 'test-token')
      .send({ content: 'hello world' })
      .expect(200);

    expect(res.body.data.buffered).toBe(true);
    expect(res.body.data.fileId).toBe('file-abc');
  });

  test('success responses include { data, meta } format', async () => {
    const res = await request(app)
      .put('/drive/files/file-abc')
      .set('X-User-Id', 'user-1')
      .set('X-Google-Access-Token', 'test-token')
      .send({ content: 'test' })
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.timestamp).toBeDefined();
  });
});
