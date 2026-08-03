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
});
