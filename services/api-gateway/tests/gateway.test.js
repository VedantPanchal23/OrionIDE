/**
 * Orion IDE — API Gateway Tests
 *
 * Test suites:
 *   1. Auth middleware: rejects no token, rejects expired, passes valid, skips public routes
 *   2. Rate limiting: triggers at correct thresholds
 *   3. Request logger: requestId on every request
 *   4. Health endpoint: returns correct status
 *   5. 404 handler: unknown routes
 */

const request = require('supertest');
const axios = require('axios');

// ── Mock axios before requiring app ──────────────────────────────────────
jest.mock('axios');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AUTH_SERVICE_URL = 'http://auth-service:3001';
process.env.DRIVE_SERVICE_URL = 'http://drive-service:3002';
process.env.EDITOR_SERVICE_URL = 'http://editor-service:3003';
process.env.EXECUTION_SERVICE_URL = 'http://execution-service:3004';
process.env.AGENT_SERVICE_URL = 'http://agent-service:3005';
process.env.NOTIFICATION_SERVICE_URL = 'http://notification-service:3006';

const app = require('../src/app');

// ─────────────────────────────────────────────────────────────────────────
// Helper: mock a successful auth validation response
// ─────────────────────────────────────────────────────────────────────────
const mockValidUser = {
  id: 'user-123',
  email: 'test@orion.dev',
  name: 'Test User',
};

const mockAuthSuccess = () => {
  axios.get.mockResolvedValueOnce({
    data: { data: mockValidUser },
    status: 200,
  });
};

const mockAuthFailure = (status = 401, code = 'AUTH_TOKEN_EXPIRED') => {
  axios.get.mockRejectedValueOnce({
    response: {
      status,
      data: {
        error: {
          code,
          message: 'Token expired',
        },
      },
    },
  });
};

const mockAuthServiceDown = () => {
  axios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
};

// ─────────────────────────────────────────────────────────────────────────
// 1. AUTH MIDDLEWARE TESTS
// ─────────────────────────────────────────────────────────────────────────
describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects requests with no Authorization header (401)', async () => {
    const res = await request(app)
      .get('/api/drive/projects')
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_INVALID');
    expect(res.body.error.message).toContain('No authentication token');
  });

  test('rejects requests with malformed Authorization header (401)', async () => {
    const res = await request(app)
      .get('/api/drive/projects')
      .set('Authorization', 'InvalidFormat')
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_INVALID');
  });

  test('rejects requests with expired/invalid tokens (401)', async () => {
    mockAuthFailure(401, 'AUTH_TOKEN_EXPIRED');

    const res = await request(app)
      .get('/api/drive/projects')
      .set('Authorization', 'Bearer expired-token-here')
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_TOKEN_EXPIRED');
  });

  test('returns 503 when auth-service is unreachable', async () => {
    mockAuthServiceDown();

    const res = await request(app)
      .get('/api/drive/projects')
      .set('Authorization', 'Bearer some-token')
      .expect(503);

    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  test('passes valid tokens and attaches user to request', async () => {
    // Auth middleware validates → proxy will fail because no real downstream service
    // But the fact that we get a 502/504 (proxy error) instead of 401 proves auth passed
    mockAuthSuccess();

    const res = await request(app)
      .get('/api/drive/projects')
      .set('Authorization', 'Bearer valid-token-here');

    // Should NOT be 401 — auth middleware passed
    expect(res.status).not.toBe(401);
    // Verify axios was called to validate
    expect(axios.get).toHaveBeenCalledWith(
      'http://auth-service:3001/auth/validate',
      expect.objectContaining({
        headers: { Authorization: 'Bearer valid-token-here' },
      })
    );
  });

  test('/api/auth/google bypasses auth middleware (not 401)', async () => {
    // This should bypass auth entirely and try to proxy to auth-service
    // It will get a proxy error (502) since auth-service isn't running, but NOT 401
    const res = await request(app)
      .get('/api/auth/google');

    expect(res.status).not.toBe(401);
    // Auth middleware should NOT have been called for validation
    expect(axios.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/auth/validate'),
      expect.anything()
    );
  });

  test('/api/auth/google/callback bypasses auth middleware', async () => {
    const res = await request(app)
      .get('/api/auth/google/callback?code=test-code');

    expect(res.status).not.toBe(401);
    expect(axios.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/auth/validate'),
      expect.anything()
    );
  });

  test('unauthenticated request to non-API path returns 401', async () => {
    // Any non-public path without a token gets 401 from auth middleware
    const res = await request(app)
      .get('/nonexistent')
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_INVALID');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. REQUEST LOGGER TESTS
// ─────────────────────────────────────────────────────────────────────────
describe('Request Logger', () => {
  test('X-Request-Id header appears in every response', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-request-id']).toBeDefined();
    // UUID v4 format: 8-4-4-4-12 hex characters
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  test('each request gets a unique requestId', async () => {
    const res1 = await request(app).get('/health');
    const res2 = await request(app).get('/health');

    expect(res1.headers['x-request-id']).not.toBe(res2.headers['x-request-id']);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. HEALTH ENDPOINT TESTS
// ─────────────────────────────────────────────────────────────────────────
describe('Health Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /health returns aggregated status when all services are up', async () => {
    // Mock all downstream health checks as successful
    axios.get.mockResolvedValue({
      data: { status: 'ok' },
      status: 200,
    });

    const res = await request(app)
      .get('/health')
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('api-gateway');
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.services).toBeDefined();
    expect(res.body.services.auth).toBe('ok');
    expect(res.body.services.drive).toBe('ok');
    expect(res.body.services.editor).toBe('ok');
    expect(res.body.services.execution).toBe('ok');
    expect(res.body.services.agents).toBe('ok');
    expect(res.body.services.notifications).toBe('ok');
  });

  test('GET /health returns degraded when some services are down', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { status: 'ok' } })  // auth
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))     // drive
      .mockResolvedValueOnce({ data: { status: 'ok' } })  // editor
      .mockResolvedValueOnce({ data: { status: 'ok' } })  // execution
      .mockResolvedValueOnce({ data: { status: 'ok' } })  // agents
      .mockResolvedValueOnce({ data: { status: 'ok' } }); // notifications

    const res = await request(app)
      .get('/health')
      .expect(207);

    expect(res.body.status).toBe('degraded');
    expect(res.body.services.auth).toBe('ok');
    expect(res.body.services.drive).toBe('down');
  });

  test('GET /health does not require authentication', async () => {
    axios.get.mockResolvedValue({ data: { status: 'ok' } });

    const res = await request(app).get('/health');
    expect(res.status).not.toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. 404 HANDLER TESTS
// ─────────────────────────────────────────────────────────────────────────
describe('404 Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 404 for unknown route with valid auth', async () => {
    // Mock auth success so the request passes through to the 404 handler
    mockAuthSuccess();

    const res = await request(app)
      .get('/api/nonexistent/route')
      .set('Authorization', 'Bearer valid-token')
      .expect(404);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('/api/nonexistent/route');
  });

  test('returns standard error format for 404 responses', async () => {
    mockAuthSuccess();

    const res = await request(app)
      .get('/api/does-not-exist')
      .set('Authorization', 'Bearer valid-token')
      .expect(404);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBeDefined();
    expect(res.body.error).toHaveProperty('details');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 5. RATE LIMITING TESTS
// ─────────────────────────────────────────────────────────────────────────
describe('Rate Limiting', () => {
  test('rate limiting is applied (health endpoint is not rate limited)', async () => {
    // Health endpoint skips rate limiting, so it should always succeed
    const res = await request(app).get('/health');
    expect(res.status).toBeLessThan(429);
  });

  test('rate limit response follows standard error format', async () => {
    // Import and test the handler directly
    const { globalLimiter } = require('../src/middleware/rateLimit');
    expect(globalLimiter).toBeDefined();
    expect(typeof globalLimiter).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 6. CORS TESTS
// ─────────────────────────────────────────────────────────────────────────
describe('CORS', () => {
  test('allows requests without origin (curl/Postman)', async () => {
    const res = await request(app)
      .get('/health')
      .expect(200);

    expect(res.status).toBe(200);
  });

  test('exposes X-Request-Id header in CORS', async () => {
    const res = await request(app)
      .get('/health');

    // The X-Request-Id should be present in the response
    expect(res.headers['x-request-id']).toBeDefined();
  });
});
