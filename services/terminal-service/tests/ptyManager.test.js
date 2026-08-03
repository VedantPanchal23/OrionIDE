/**
 * Terminal ptyManager unit tests
 */

jest.mock('node-pty', () => ({
  spawn: jest.fn(() => ({
    write: jest.fn(),
    resize: jest.fn(),
    kill: jest.fn(),
    onData: jest.fn(() => ({ dispose: jest.fn() })),
    onExit: jest.fn(() => ({ dispose: jest.fn() })),
  })),
}));

const path = require('path');
const fs = require('fs');
const os = require('os');

describe('ptyManager sandbox', () => {
  let ptyManager;
  let workspace;

  beforeAll(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'orion-term-test-'));
    process.env.TERMINAL_WORKSPACE_ROOT = workspace;
    jest.resetModules();
    jest.mock('node-pty', () => ({
      spawn: jest.fn(() => ({
        write: jest.fn(),
        resize: jest.fn(),
        kill: jest.fn(),
        onData: jest.fn(() => ({ dispose: jest.fn() })),
        onExit: jest.fn(() => ({ dispose: jest.fn() })),
      })),
    }));
    ptyManager = require('../src/services/ptyManager');
  });

  afterAll(() => {
    try { ptyManager.destroyAll(); } catch { /* */ }
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  afterEach(() => {
    try { ptyManager.destroyAll(); } catch { /* */ }
  });

  test('buildSafeEnv does not leak secrets', () => {
    process.env.JWT_SECRET = 'super-secret';
    process.env.GROQ_API_KEY = 'gsk_test';
    process.env.PATH = process.env.PATH || '/usr/bin';
    const env = ptyManager.buildSafeEnv();
    expect(env.JWT_SECRET).toBeUndefined();
    expect(env.GROQ_API_KEY).toBeUndefined();
    expect(env.TERM).toBe('xterm-256color');
  });

  test('resolveSafeCwd rejects escape outside user workspace', () => {
    expect(() => ptyManager.resolveSafeCwd('user-a', path.join(workspace, '..', '..'))).toThrow(/workspace/i);
  });

  test('resolveSafeCwd allows project under user workspace', () => {
    const projectDir = path.join(workspace, 'user-a', 'my-project');
    fs.mkdirSync(projectDir, { recursive: true });
    const resolved = ptyManager.resolveSafeCwd('user-a', 'my-project');
    expect(resolved).toBe(path.resolve(projectDir));
  });

  test('sessions are isolated per user root', () => {
    const a = ptyManager.createSession('user-a', { cwd: '.' });
    const b = ptyManager.createSession('user-b', { cwd: '.' });
    expect(a.cwd).toContain(`${path.sep}user-a`);
    expect(b.cwd).toContain(`${path.sep}user-b`);
    expect(a.cwd).not.toBe(b.cwd);
  });

  test('createSession returns connectToken bound to user', () => {
    const session = ptyManager.createSession('user-a', { cwd: '.' });
    expect(session.terminalId).toBeDefined();
    expect(session.connectToken).toMatch(/^[a-f0-9]{48}$/);
    const stored = ptyManager.getSession(session.terminalId);
    expect(stored.userId).toBe('user-a');
    expect(stored.connectToken).toBe(session.connectToken);
  });

  test('enforces max 5 sessions per user', () => {
    for (let i = 0; i < 5; i++) {
      ptyManager.createSession('limit-user', {});
    }
    expect(() => ptyManager.createSession('limit-user', {})).toThrow(/Maximum/);
  });
});
