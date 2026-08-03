/**
 * DAP Content-Length framing (Debug Adapter Protocol).
 * Messages are: Content-Length: N\r\n\r\n{json}
 */

const HEADER_SEP = '\r\n\r\n';

class DapFramer {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }

  encode(message) {
    const json = JSON.stringify(message);
    const body = Buffer.from(json, 'utf8');
    const header = Buffer.from(`Content-Length: ${body.length}${HEADER_SEP}`, 'utf8');
    return Buffer.concat([header, body]);
  }

  /**
   * Feed raw bytes; returns decoded DAP messages (array).
   */
  feed(chunk) {
    this.buffer = Buffer.concat([this.buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    const messages = [];

    while (true) {
      const sep = this.buffer.indexOf(HEADER_SEP);
      if (sep < 0) break;

      const header = this.buffer.slice(0, sep).toString('utf8');
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        // Skip malformed header line
        this.buffer = this.buffer.slice(sep + HEADER_SEP.length);
        continue;
      }

      const length = Number(match[1]);
      const bodyStart = sep + HEADER_SEP.length;
      if (this.buffer.length < bodyStart + length) break;

      const body = this.buffer.slice(bodyStart, bodyStart + length).toString('utf8');
      this.buffer = this.buffer.slice(bodyStart + length);
      try {
        messages.push(JSON.parse(body));
      } catch {
        // ignore bad JSON
      }
    }

    return messages;
  }
}

module.exports = { DapFramer };
