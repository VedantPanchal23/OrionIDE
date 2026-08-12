/**
 * LSP Content-Length framing over Node streams / WebSocket.
 */

function createStreamFramer(onMessage) {
  let buffer = Buffer.alloc(0);

  return {
    push(chunk) {
      buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
      while (true) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;
        const header = buffer.slice(0, headerEnd).toString('utf8');
        const match = /Content-Length:\s*(\d+)/i.exec(header);
        if (!match) {
          buffer = buffer.slice(headerEnd + 4);
          continue;
        }
        const length = Number(match[1]);
        const total = headerEnd + 4 + length;
        if (buffer.length < total) return;
        const body = buffer.slice(headerEnd + 4, total).toString('utf8');
        buffer = buffer.slice(total);
        try {
          onMessage(JSON.parse(body));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[lsp] bad JSON from language server:', err.message);
        }
      }
    },
  };
}

function encodeMessage(msg) {
  const json = JSON.stringify(msg);
  return `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
}

module.exports = { createStreamFramer, encodeMessage };
