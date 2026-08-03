/**
 * DAP adapter path helpers / framing integration smoke
 */

const { DapFramer } = require('../src/services/dap/framing');
const { NodeInspectorAdapter } = require('../src/services/dap/nodeAdapter');

describe('NodeInspectorAdapter helpers', () => {
  test('pathToUrlRegex matches absolute POSIX paths', () => {
    const adapter = new NodeInspectorAdapter();
    const re = new RegExp(adapter._pathToUrlRegex('/workspace/debug-demo/main.js'));
    expect(re.test('file:///workspace/debug-demo/main.js')).toBe(true);
    expect(re.test('/workspace/debug-demo/main.js')).toBe(true);
    expect(re.test('/other/main.js')).toBe(false);
  });

  test('normalizePath strips file://', () => {
    const adapter = new NodeInspectorAdapter();
    expect(adapter._normalizePath('file:///workspace/a.js')).toBe('/workspace/a.js');
    expect(adapter._normalizePath('/workspace/a.js')).toBe('/workspace/a.js');
  });
});

describe('DAP request/response round-trip via framer', () => {
  test('initialize-style exchange', () => {
    const f = new DapFramer();
    const req = f.encode({ seq: 1, type: 'request', command: 'initialize', arguments: { adapterID: 'python' } });
    const [parsed] = f.feed(req);
    expect(parsed.command).toBe('initialize');
    expect(parsed.arguments.adapterID).toBe('python');
  });
});
