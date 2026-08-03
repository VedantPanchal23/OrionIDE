/**
 * Git HTTP route smoke tests (filesystem + real git when available)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.TERMINAL_WORKSPACE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'orion-git-http-'));

const app = require('../src/app');
const { projectRoot } = require('../src/services/gitService');

const userId = 'user-git-1';
const projectId = 'proj-git-1';

describe('Git HTTP routes', () => {
  beforeAll(() => {
    const root = projectRoot(userId, projectId);
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'hello.txt'), 'hello\n', 'utf8');
  });

  afterAll(() => {
    try {
      fs.rmSync(process.env.TERMINAL_WORKSPACE_ROOT, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('GET /git/status requires auth', async () => {
    const res = await request(app).get('/git/status').expect(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('GET /git/status requires projectId', async () => {
    const res = await request(app)
      .get('/git/status')
      .set('X-User-Id', userId)
      .expect(400);
    expect(res.body.error.code).toBe('GIT_MISSING_PROJECT');
  });

  test('GET /git/status returns branch + untracked after init', async () => {
    const res = await request(app)
      .get(`/git/status?projectId=${projectId}`)
      .set('X-User-Id', userId)
      .expect(200);

    expect(res.body.data.branch).toBeTruthy();
    expect(res.body.data.untracked.some((f) => f.path === 'hello.txt')).toBe(true);
  });

  test('POST /git/commit stages and commits files', async () => {
    const res = await request(app)
      .post('/git/commit')
      .set('X-User-Id', userId)
      .send({ projectId, message: 'initial commit', files: ['hello.txt'] })
      .expect(200);

    expect(res.body.data.committed).toBe(true);

    const status = await request(app)
      .get(`/git/status?projectId=${projectId}`)
      .set('X-User-Id', userId)
      .expect(200);

    expect(status.body.data.untracked).toHaveLength(0);
    expect(status.body.data.unstaged).toHaveLength(0);
  });
});
