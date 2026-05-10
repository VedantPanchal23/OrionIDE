/**
 * Orion IDE — Notification Service Tests
 */

const request = require('supertest');

// Mock Redis
jest.mock('../src/services/redisClient', () => ({
  getCommandClient: jest.fn(() => Promise.resolve({ publish: jest.fn(() => Promise.resolve(1)) })),
  getSubscriberClient: jest.fn(() => Promise.resolve({ subscribe: jest.fn(() => Promise.resolve()) })),
  closeAll: jest.fn(),
}));

process.env.NODE_ENV = 'test';
process.env.INTERNAL_SECRET = 'test-secret';

const app = require('../src/app');
const { addConnection, sendToUser, sendToAll, getStats, _connections } = require('../src/services/sseService');

describe('SSE Service', () => {
  beforeEach(() => { _connections.clear(); });

  test('addConnection stores connection', () => {
    const mockRes = { on: jest.fn(), write: jest.fn() };
    const connId = addConnection('user-1', mockRes);
    expect(connId).toBeDefined();
    expect(getStats().users).toBe(1);
    expect(getStats().connections).toBe(1);
  });

  test('sendToUser sends to correct user', () => {
    const mockRes = { on: jest.fn(), write: jest.fn() };
    addConnection('user-1', mockRes);
    const sent = sendToUser('user-1', { type: 'TEST', payload: 'hello' });
    expect(sent).toBe(1);
    expect(mockRes.write).toHaveBeenCalled();
  });

  test('sendToUser returns 0 for unknown user', () => {
    const sent = sendToUser('unknown', { type: 'TEST' });
    expect(sent).toBe(0);
  });

  test('sendToAll broadcasts to all users', () => {
    const res1 = { on: jest.fn(), write: jest.fn() };
    const res2 = { on: jest.fn(), write: jest.fn() };
    addConnection('user-1', res1);
    addConnection('user-2', res2);
    const sent = sendToAll({ type: 'BROADCAST' });
    expect(sent).toBe(2);
  });

  test('multiple connections per user', () => {
    const res1 = { on: jest.fn(), write: jest.fn() };
    const res2 = { on: jest.fn(), write: jest.fn() };
    addConnection('user-1', res1);
    addConnection('user-1', res2);
    expect(getStats().users).toBe(1);
    expect(getStats().connections).toBe(2);
    const sent = sendToUser('user-1', { type: 'TEST' });
    expect(sent).toBe(2);
  });
});

describe('Notification Routes', () => {
  beforeEach(() => { _connections.clear(); });

  test('POST /notifications/publish requires internal secret', async () => {
    const res = await request(app)
      .post('/notifications/publish')
      .send({ type: 'TEST', userId: 'user-1' })
      .expect(403);
    expect(res.body.error.code).toBe('NOTIF_FORBIDDEN');
  });

  test('POST /notifications/publish with valid secret succeeds', async () => {
    const res = await request(app)
      .post('/notifications/publish')
      .set('X-Internal-Secret', 'test-secret')
      .send({ type: 'DRIVE_FILE_SAVED', userId: 'user-1', payload: { fileId: 'f1' } })
      .expect(200);
    expect(res.body.data).toBeDefined();
  });

  test('POST /notifications/publish requires type', async () => {
    const res = await request(app)
      .post('/notifications/publish')
      .set('X-Internal-Secret', 'test-secret')
      .send({ userId: 'user-1' })
      .expect(400);
    expect(res.body.error.code).toBe('NOTIF_MISSING_PARAM');
  });

  test('POST /notifications/publish with broadcast', async () => {
    const mockRes = { on: jest.fn(), write: jest.fn() };
    addConnection('user-1', mockRes);

    const res = await request(app)
      .post('/notifications/publish')
      .set('X-Internal-Secret', 'test-secret')
      .send({ type: 'SYSTEM_MSG', broadcast: true, payload: { msg: 'hi' } })
      .expect(200);
    expect(res.body.data.broadcast).toBe(true);
    expect(res.body.data.sent).toBe(1);
  });

  test('GET /notifications/stream requires userId', async () => {
    const res = await request(app)
      .get('/notifications/stream')
      .expect(401);
    expect(res.body.error.code).toBe('NOTIF_NO_AUTH');
  });

  test('GET /notifications/health returns stats', async () => {
    const res = await request(app).get('/notifications/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.users).toBeDefined();
    expect(res.body.connections).toBeDefined();
  });

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });
});
