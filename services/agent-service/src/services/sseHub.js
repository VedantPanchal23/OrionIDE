/**
 * Shared SSE event queues for agent pipeline + freeform chat.
 */

const sessionStreams = new Map();

const pushEvent = (sessionId, event) => {
  if (!sessionStreams.has(sessionId)) sessionStreams.set(sessionId, []);
  sessionStreams.get(sessionId).push({ ...event, timestamp: new Date().toISOString() });
};

const streamSession = (res, sessionId) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const events = sessionStreams.get(sessionId) || [];
  sessionStreams.set(sessionId, events);
  let sentCount = 0;
  let closed = false;

  const interval = setInterval(() => {
    if (closed) return;
    res.write(': heartbeat\n\n');
    while (sentCount < events.length) {
      const evt = events[sentCount];
      res.write(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
      sentCount += 1;
    }
  }, 500);

  res.on('close', () => {
    closed = true;
    clearInterval(interval);
  });

  setTimeout(() => {
    if (!closed) {
      res.end();
      closed = true;
      clearInterval(interval);
    }
  }, 300000);
};

module.exports = { pushEvent, streamSession };
