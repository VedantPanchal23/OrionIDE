/**
 * shared/utils/notify.js — non-throwing publisher
 */

const http = require('http');

describe('publishEvent', () => {
  let server;
  let port;
  let lastBody;
  let lastSecret;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/notifications/publish') {
        lastSecret = req.headers['x-internal-secret'];
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          lastBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: { ok: true } }));
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('posts event with internal secret', async () => {
    process.env.INTERNAL_SECRET = 'test-secret';
    process.env.NOTIFICATION_SERVICE_URL = `http://127.0.0.1:${port}`;
    jest.resetModules();
    const { publishEvent } = require('../../../shared/utils/notify');

    const ok = await publishEvent({
      type: 'FILE_SAVED',
      userId: 'u1',
      payload: { fileId: 'f1' },
    });

    expect(ok).toBe(true);
    expect(lastSecret).toBe('test-secret');
    expect(lastBody).toMatchObject({
      type: 'FILE_SAVED',
      userId: 'u1',
      payload: { fileId: 'f1' },
    });
  });

  test('returns false when secret missing (no throw)', async () => {
    delete process.env.INTERNAL_SECRET;
    delete process.env.DRIVE_SERVICE_SECRET;
    process.env.NOTIFICATION_SERVICE_URL = `http://127.0.0.1:${port}`;
    jest.resetModules();
    const { publishEvent } = require('../../../shared/utils/notify');
    await expect(publishEvent({ type: 'X', userId: 'u' })).resolves.toBe(false);
  });
});
