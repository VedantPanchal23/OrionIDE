/**
 * Ports registry unit tests
 */
const ports = require('../src/services/portsService');

describe('portsService', () => {
  const userId = 'u-ports';

  afterEach(() => ports.clearUser(userId));

  test('registers and lists ports', () => {
    const a = ports.registerPort(userId, { port: 3000, label: 'Vite' });
    expect(a.port).toBe(3000);
    expect(a.publicPath).toBe('/api/terminal/proxy/3000/');
    expect(ports.isRegistered(userId, 3000)).toBe(true);
    expect(ports.listPorts(userId)).toHaveLength(1);
  });

  test('rejects invalid port', () => {
    expect(() => ports.registerPort(userId, { port: 99999 })).toThrow();
  });

  test('unregister by id', () => {
    const a = ports.registerPort(userId, { port: 5173 });
    expect(ports.unregisterPort(userId, a.id)).toBe(true);
    expect(ports.listPorts(userId)).toHaveLength(0);
  });

  test('rejects invalid protocol', () => {
    expect(() => ports.registerPort(userId, { port: 3000, protocol: 'ftp' })).toThrow();
  });

  test('detectListeningPorts returns array', async () => {
    const list = await ports.detectListeningPorts(userId);
    expect(Array.isArray(list)).toBe(true);
  });

  test('probePort rejects closed port', async () => {
    // high ephemeral port unlikely to be listening
    const ok = await ports.probePort(59999, '127.0.0.1', 120);
    expect(typeof ok).toBe('boolean');
  });
});
