/**
 * DAP framing unit tests
 */

const { DapFramer } = require('../src/services/dap/framing');

describe('DapFramer', () => {
  test('encodes Content-Length framed message', () => {
    const f = new DapFramer();
    const buf = f.encode({ seq: 1, type: 'request', command: 'initialize' });
    const text = buf.toString('utf8');
    expect(text).toMatch(/^Content-Length: \d+\r\n\r\n/);
    expect(text).toContain('"command":"initialize"');
  });

  test('decodes a single framed message', () => {
    const f = new DapFramer();
    const encoded = f.encode({ seq: 2, type: 'response', request_seq: 1, success: true, command: 'initialize', body: { ok: true } });
    const msgs = f.feed(encoded);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].body.ok).toBe(true);
  });

  test('handles chunked feed', () => {
    const f = new DapFramer();
    const encoded = f.encode({ type: 'event', event: 'stopped', body: { reason: 'breakpoint' } });
    const mid = Math.floor(encoded.length / 2);
    expect(f.feed(encoded.slice(0, mid))).toHaveLength(0);
    const msgs = f.feed(encoded.slice(mid));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].event).toBe('stopped');
  });
});
