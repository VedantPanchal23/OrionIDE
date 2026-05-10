/**
 * Orion IDE — Editor Service Tests
 */

const request = require('supertest');

// Mock Redis
jest.mock('../src/services/redisClient', () => {
  const store = new Map();
  const mockRedis = {
    get: jest.fn((key) => Promise.resolve(store.get(key) || null)),
    set: jest.fn((key, value) => { store.set(key, value); return Promise.resolve('OK'); }),
    del: jest.fn((key) => { store.delete(key); return Promise.resolve(1); }),
    expire: jest.fn(() => Promise.resolve(1)),
    isOpen: true,
  };
  return {
    getRedisClient: jest.fn(() => Promise.resolve(mockRedis)),
    closeRedisClient: jest.fn(),
    _mockRedis: mockRedis,
    _store: store,
  };
});

process.env.NODE_ENV = 'test';

const { app } = require('../src/app');
const { openFile, closeFile, getSession, setActiveFile, markDirty } = require('../src/services/sessionService');
const { _store } = require('../src/services/redisClient');

describe('Session Service', () => {
  beforeEach(() => { _store.clear(); });

  test('openFile stores session in Redis', async () => {
    const session = await openFile('user-1', 'file-a', 'app.js', 'javascript');
    expect(session.openFiles).toHaveLength(1);
    expect(session.openFiles[0].fileId).toBe('file-a');
    expect(session.openFiles[0].fileName).toBe('app.js');
    expect(session.openFiles[0].language).toBe('javascript');
    expect(session.openFiles[0].isDirty).toBe(false);
    expect(session.activeFileId).toBe('file-a');
  });

  test('openFile does not duplicate already-open files', async () => {
    await openFile('user-1', 'file-a', 'app.js', 'javascript');
    const session = await openFile('user-1', 'file-a', 'app.js', 'javascript');
    expect(session.openFiles).toHaveLength(1);
  });

  test('openFile sets new file as active', async () => {
    await openFile('user-1', 'file-a', 'app.js', 'javascript');
    const session = await openFile('user-1', 'file-b', 'index.html', 'html');
    expect(session.activeFileId).toBe('file-b');
    expect(session.openFiles).toHaveLength(2);
  });

  test('closeFile removes from session', async () => {
    await openFile('user-1', 'file-a', 'app.js', 'javascript');
    await openFile('user-1', 'file-b', 'index.html', 'html');
    const session = await closeFile('user-1', 'file-a');
    expect(session.openFiles).toHaveLength(1);
    expect(session.openFiles[0].fileId).toBe('file-b');
  });

  test('closeFile switches active when closing active', async () => {
    await openFile('user-1', 'file-a', 'app.js', 'javascript');
    await openFile('user-1', 'file-b', 'index.html', 'html');
    const session = await closeFile('user-1', 'file-b'); // active is file-b
    expect(session.activeFileId).toBe('file-a');
  });

  test('closeFile sets null when last file closed', async () => {
    await openFile('user-1', 'file-a', 'app.js', 'javascript');
    const session = await closeFile('user-1', 'file-a');
    expect(session.openFiles).toHaveLength(0);
    expect(session.activeFileId).toBeNull();
  });

  test('getSession returns empty default for new user', async () => {
    const session = await getSession('new-user');
    expect(session.openFiles).toEqual([]);
    expect(session.activeFileId).toBeNull();
  });

  test('session restored correctly on reload (data persists)', async () => {
    await openFile('user-1', 'file-a', 'app.js', 'javascript');
    await openFile('user-1', 'file-b', 'styles.css', 'css');
    const session = await getSession('user-1');
    expect(session.openFiles).toHaveLength(2);
    expect(session.activeFileId).toBe('file-b');
  });

  test('setActiveFile changes active without modifying openFiles', async () => {
    await openFile('user-1', 'file-a', 'app.js', 'javascript');
    await openFile('user-1', 'file-b', 'index.html', 'html');
    const session = await setActiveFile('user-1', 'file-a');
    expect(session.activeFileId).toBe('file-a');
    expect(session.openFiles).toHaveLength(2);
  });

  test('markDirty updates dirty state', async () => {
    await openFile('user-1', 'file-a', 'app.js', 'javascript');
    const session = await markDirty('user-1', 'file-a', true);
    expect(session.openFiles[0].isDirty).toBe(true);
    const session2 = await markDirty('user-1', 'file-a', false);
    expect(session2.openFiles[0].isDirty).toBe(false);
  });
});

describe('Editor Routes', () => {
  beforeEach(() => { _store.clear(); });

  test('POST /editor/session/open creates session', async () => {
    const res = await request(app)
      .post('/editor/session/open')
      .set('X-User-Id', 'user-1')
      .send({ fileId: 'f1', fileName: 'app.js', language: 'javascript' })
      .expect(200);
    expect(res.body.data.openFiles).toHaveLength(1);
    expect(res.body.data.activeFileId).toBe('f1');
  });

  test('DELETE /editor/session/close/:fileId removes file', async () => {
    await request(app).post('/editor/session/open').set('X-User-Id', 'user-1').send({ fileId: 'f1', fileName: 'a.js', language: 'javascript' });
    const res = await request(app).delete('/editor/session/close/f1').set('X-User-Id', 'user-1').expect(200);
    expect(res.body.data.openFiles).toHaveLength(0);
  });

  test('GET /editor/session/state returns session', async () => {
    await request(app).post('/editor/session/open').set('X-User-Id', 'user-1').send({ fileId: 'f1', fileName: 'a.js', language: 'javascript' });
    const res = await request(app).get('/editor/session/state').set('X-User-Id', 'user-1').expect(200);
    expect(res.body.data.openFiles).toHaveLength(1);
  });

  test('PATCH /editor/session/active sets active file', async () => {
    await request(app).post('/editor/session/open').set('X-User-Id', 'user-1').send({ fileId: 'f1', fileName: 'a.js', language: 'javascript' });
    await request(app).post('/editor/session/open').set('X-User-Id', 'user-1').send({ fileId: 'f2', fileName: 'b.js', language: 'javascript' });
    const res = await request(app).patch('/editor/session/active').set('X-User-Id', 'user-1').send({ fileId: 'f1' }).expect(200);
    expect(res.body.data.activeFileId).toBe('f1');
  });

  test('PATCH /editor/session/dirty marks file dirty', async () => {
    await request(app).post('/editor/session/open').set('X-User-Id', 'user-1').send({ fileId: 'f1', fileName: 'a.js', language: 'javascript' });
    const res = await request(app).patch('/editor/session/dirty').set('X-User-Id', 'user-1').send({ fileId: 'f1', isDirty: true }).expect(200);
    expect(res.body.data.openFiles[0].isDirty).toBe(true);
  });

  test('routes require X-User-Id header', async () => {
    const res = await request(app).get('/editor/session/state').expect(401);
    expect(res.body.error.code).toBe('EDITOR_NO_AUTH');
  });

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });
});
