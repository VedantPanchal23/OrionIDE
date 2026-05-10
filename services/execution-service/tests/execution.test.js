/**
 * Orion IDE — Execution Service Tests
 */

const request = require('supertest');

// Mock Redis
jest.mock('../src/services/redisClient', () => {
  const store = new Map();
  const mockRedis = {
    get: jest.fn((key) => Promise.resolve(store.get(key) || null)),
    set: jest.fn((key, value) => { store.set(key, value); return Promise.resolve('OK'); }),
    del: jest.fn((key) => { store.delete(key); return Promise.resolve(1); }),
    incr: jest.fn((key) => {
      const val = (parseInt(store.get(key) || '0', 10)) + 1;
      store.set(key, String(val));
      return Promise.resolve(val);
    }),
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

// Mock Piston API (axios)
jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

process.env.NODE_ENV = 'test';

const axios = require('axios');
const app = require('../src/app');
const { resolveLanguage } = require('../src/services/pistonService');
const { getByExtension } = require('../src/services/languageMap');
const { _store } = require('../src/services/redisClient');

// ── Piston Service ──────────────────────────────────────────────────────

describe('Piston Service — Language Map', () => {
  test('resolves Python from extension', () => {
    const lang = resolveLanguage('py');
    expect(lang.pistonLanguage).toBe('python');
  });

  test('resolves JavaScript from extension', () => {
    const lang = resolveLanguage('js');
    expect(lang.pistonLanguage).toBe('javascript');
  });

  test('resolves Java from extension', () => {
    const lang = resolveLanguage('java');
    expect(lang.pistonLanguage).toBe('java');
  });

  test('resolves from piston language name', () => {
    const lang = resolveLanguage('python');
    expect(lang.pistonLanguage).toBe('python');
  });

  test('returns null for unknown language', () => {
    const lang = resolveLanguage('brainfuck');
    expect(lang).toBeNull();
  });

  test('non-executable languages have null pistonLanguage', () => {
    const html = getByExtension('.html');
    const css = getByExtension('.css');
    const json = getByExtension('.json');
    expect(html.pistonLanguage).toBeNull();
    expect(css.pistonLanguage).toBeNull();
    expect(json.pistonLanguage).toBeNull();
  });
});

// ── Routes ──────────────────────────────────────────────────────────────

describe('Execution Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _store.clear();
  });

  test('POST /execute with Python code returns executionId', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        language: 'python',
        version: '3.10.0',
        run: { stdout: 'Hello Orion\n', stderr: '', code: 0, signal: null },
      },
    });

    const res = await request(app)
      .post('/execute')
      .set('X-User-Id', 'user-1')
      .send({ language: 'py', fileName: 'main.py', code: 'print("Hello Orion")' })
      .expect(201);

    expect(res.body.data.executionId).toBeDefined();
    expect(typeof res.body.data.executionId).toBe('string');
  });

  test('POST /execute requires language and code', async () => {
    const res = await request(app)
      .post('/execute')
      .set('X-User-Id', 'user-1')
      .send({})
      .expect(400);

    expect(res.body.error.code).toBe('EXEC_MISSING_PARAM');
  });

  test('POST /execute rejects non-executable language', async () => {
    const res = await request(app)
      .post('/execute')
      .set('X-User-Id', 'user-1')
      .send({ language: 'html', code: '<h1>Hi</h1>' })
      .expect(422);

    expect(res.body.error.code).toBe('LANGUAGE_NOT_AVAILABLE');
  });

  test('Rate limit: 11th request in 1 minute returns 429', async () => {
    // Simulate 10 successful executions
    for (let i = 0; i < 10; i++) {
      axios.post.mockResolvedValueOnce({
        data: { run: { stdout: '', stderr: '', code: 0, signal: null } },
      });
    }

    // First 10 should succeed
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/execute')
        .set('X-User-Id', 'rate-test-user')
        .send({ language: 'py', code: 'x=1' })
        .expect(201);
    }

    // 11th should be rate limited
    const res = await request(app)
      .post('/execute')
      .set('X-User-Id', 'rate-test-user')
      .send({ language: 'py', code: 'x=1' })
      .expect(429);

    expect(res.body.error.code).toBe('EXEC_RATE_LIMIT');
  });

  test('GET /execute/:id/result returns 404 for unknown execution', async () => {
    const res = await request(app)
      .get('/execute/unknown-id/result')
      .expect(404);

    expect(res.body.error.code).toBe('EXEC_NOT_FOUND');
  });

  test('GET /execute/:id/result returns stored result', async () => {
    // Pre-store a record
    const record = {
      executionId: 'test-exec-1',
      status: 'completed',
      stdout: 'Hello\n',
      stderr: '',
      exitCode: 0,
      time: '0.123',
    };
    _store.set('exec:record:test-exec-1', JSON.stringify(record));

    const res = await request(app)
      .get('/execute/test-exec-1/result')
      .expect(200);

    expect(res.body.data.executionId).toBe('test-exec-1');
    expect(res.body.data.stdout).toBe('Hello\n');
    expect(res.body.data.exitCode).toBe(0);
  });

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('execution-service');
  });
});
