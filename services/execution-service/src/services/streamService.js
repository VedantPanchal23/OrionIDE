/**
 * Orion IDE — Stream Service
 *
 * Manages execution lifecycle and SSE streaming of results.
 *
 * Flow:
 *   1. Client POSTs /execute -> createExecution() stores record, returns executionId
 *   2. Service calls Piston API in background
 *   3. Client GETs /execute/:id/stream -> SSE events pushed as results arrive
 *
 * Redis keys:
 *   exec:record:{executionId}   — execution state + result (TTL 10m)
 *   exec:ratelimit:{userId}     — counter (TTL 60s), max 10 per minute
 */

const { v4: uuidv4 } = require('uuid');
const { getRedisClient } = require('./redisClient');
const { execute, resolveLanguage } = require('./pistonService');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('execution-service');

const RECORD_PREFIX = 'exec:record:';
const RATE_PREFIX = 'exec:ratelimit:';
const RECORD_TTL = 600;   // 10 minutes
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60; // 60 seconds

// In-memory event emitters for SSE (active executions only)
const activeStreams = new Map();

/**
 * Check rate limit for a user.
 * @param {string} userId
 * @returns {Promise<{ allowed: boolean, remaining: number }>}
 */
const checkRateLimit = async (userId) => {
  const redis = await getRedisClient();
  const key = `${RATE_PREFIX}${userId}`;

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW);
  }

  return {
    allowed: current <= RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - current),
    limit: RATE_LIMIT_MAX,
  };
};

/**
 * Create a new execution record and start execution asynchronously.
 *
 * @param {string} userId
 * @param {string} language — file extension or piston language name
 * @param {string} fileName
 * @param {string} code
 * @param {string} [stdin]
 * @returns {Promise<{ executionId: string }>}
 */
const createExecution = async (userId, language, fileName, code, stdin) => {
  const executionId = uuidv4();
  const resolved = resolveLanguage(language);

  if (!resolved || !resolved.pistonLanguage) {
    throw Object.assign(new Error(`Language '${language}' is not executable`), { code: 'EXEC_UNSUPPORTED_LANG' });
  }

  // Store initial record
  const record = {
    executionId,
    userId,
    language: resolved.pistonLanguage,
    version: resolved.version,
    fileName,
    status: 'running',
    stdout: '',
    stderr: '',
    exitCode: null,
    time: null,
    timedOut: false,
    createdAt: new Date().toISOString(),
  };

  const redis = await getRedisClient();
  await redis.set(`${RECORD_PREFIX}${executionId}`, JSON.stringify(record), { EX: RECORD_TTL });

  // Create event queue for SSE
  activeStreams.set(executionId, []);

  // Execute asynchronously
  setImmediate(async () => {
    try {
      const result = await execute(resolved.pistonLanguage, resolved.version, fileName, code, stdin);

      // Push SSE events
      const events = activeStreams.get(executionId) || [];

      if (result.stdout) {
        events.push({ event: 'stdout', data: result.stdout });
      }
      if (result.stderr) {
        events.push({ event: 'stderr', data: result.stderr });
      }
      events.push({
        event: 'exit',
        data: JSON.stringify({
          exitCode: result.exitCode,
          time: result.time,
          timedOut: result.timedOut,
        }),
      });

      // Update record
      record.status = 'completed';
      record.stdout = result.stdout;
      record.stderr = result.stderr;
      record.exitCode = result.exitCode;
      record.time = result.time;
      record.timedOut = result.timedOut;

      await redis.set(`${RECORD_PREFIX}${executionId}`, JSON.stringify(record), { EX: RECORD_TTL });

      logger.info('Execution completed', {
        executionId,
        language: resolved.pistonLanguage,
        exitCode: result.exitCode,
        time: result.time,
      });
    } catch (err) {
      const events = activeStreams.get(executionId) || [];
      events.push({ event: 'error', data: JSON.stringify({ message: err.message }) });

      record.status = 'error';
      record.stderr = err.message;
      record.exitCode = -1;

      await redis.set(`${RECORD_PREFIX}${executionId}`, JSON.stringify(record), { EX: RECORD_TTL }).catch(() => {});

      logger.error('Execution failed', { executionId, error: err.message });
    }
  });

  return { executionId };
};

/**
 * Stream execution results via SSE.
 *
 * @param {import('express').Response} res
 * @param {string} executionId
 */
const streamResult = (res, executionId) => {
  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const events = activeStreams.get(executionId);
  let sentCount = 0;
  let closed = false;

  const sendEvent = (event, data) => {
    if (closed) return;
    res.write(`event: ${event}\ndata: ${data}\n\n`);
  };

  // Poll for new events
  const interval = setInterval(() => {
    if (!events) {
      sendEvent('error', JSON.stringify({ message: 'Execution not found' }));
      cleanup();
      return;
    }

    while (sentCount < events.length) {
      const evt = events[sentCount];
      sendEvent(evt.event, evt.data);
      sentCount++;

      // Close after exit or error
      if (evt.event === 'exit' || evt.event === 'error') {
        cleanup();
        return;
      }
    }
  }, 100); // Check every 100ms

  const cleanup = () => {
    closed = true;
    clearInterval(interval);
    res.end();
    // Keep events in memory briefly for the result endpoint, then clean up
    setTimeout(() => activeStreams.delete(executionId), 5000);
  };

  // Client disconnect
  res.on('close', cleanup);

  // Safety timeout: 60 seconds max
  setTimeout(() => {
    if (!closed) {
      sendEvent('error', JSON.stringify({ message: 'Stream timeout' }));
      cleanup();
    }
  }, 60000);
};

/**
 * Get the final execution result (polling fallback).
 *
 * @param {string} executionId
 * @returns {Promise<object|null>}
 */
const getResult = async (executionId) => {
  const redis = await getRedisClient();
  const data = await redis.get(`${RECORD_PREFIX}${executionId}`);
  return data ? JSON.parse(data) : null;
};

module.exports = {
  createExecution,
  streamResult,
  getResult,
  checkRateLimit,
};
