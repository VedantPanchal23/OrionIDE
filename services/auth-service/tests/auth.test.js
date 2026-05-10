/**
 * Orion IDE — Auth Service Tests
 *
 * Test suites:
 *   1. Token Service: JWT generation, verification, expiry, tampering
 *   2. Redis: refresh token storage, validation, revocation
 *   3. Auth Routes: /auth/validate, /auth/refresh, /auth/logout, /auth/me
 */

const jwt = require('jsonwebtoken');
const request = require('supertest');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-only-64-chars-long-minimum-required';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-unit-tests-only-64-chars-long-minimum-req';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';

const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  buildPayload,
} = require('../src/services/tokenService');

const app = require('../src/app');

// ── Test User ────────────────────────────────────────────────────────────
const testUser = {
  userId: 'google-user-12345',
  email: 'test@orion.dev',
  name: 'Test User',
  picture: 'https://lh3.googleusercontent.com/photo.jpg',
  googleAccessToken: 'ya29.google-access-token-here',
};

// ─────────────────────────────────────────────────────────────────────────
// 1. TOKEN SERVICE — JWT Generation
// ─────────────────────────────────────────────────────────────────────────
describe('Token Service — Generation', () => {
  test('generateAccessToken creates valid JWT with correct payload', () => {
    const token = generateAccessToken(testUser);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    // Decode without verification to check payload
    const decoded = jwt.decode(token);

    expect(decoded.userId).toBe(testUser.userId);
    expect(decoded.email).toBe(testUser.email);
    expect(decoded.name).toBe(testUser.name);
    expect(decoded.picture).toBe(testUser.picture);
    expect(decoded.googleAccessToken).toBe(testUser.googleAccessToken);
    expect(decoded.type).toBe('access');
    expect(decoded.jti).toBeDefined(); // JWT ID for revocation
    expect(decoded.exp).toBeDefined(); // Expiry
    expect(decoded.iat).toBeDefined(); // Issued at
  });

  test('generateRefreshToken creates valid JWT with correct payload', () => {
    const token = generateRefreshToken(testUser);

    expect(token).toBeDefined();

    const decoded = jwt.decode(token);

    expect(decoded.userId).toBe(testUser.userId);
    expect(decoded.email).toBe(testUser.email);
    expect(decoded.type).toBe('refresh');
    expect(decoded.jti).toBeDefined();
    expect(decoded.exp).toBeDefined();
  });

  test('access and refresh tokens have different types', () => {
    const accessToken = generateAccessToken(testUser);
    const refreshToken = generateRefreshToken(testUser);

    const accessDecoded = jwt.decode(accessToken);
    const refreshDecoded = jwt.decode(refreshToken);

    expect(accessDecoded.type).toBe('access');
    expect(refreshDecoded.type).toBe('refresh');
  });

  test('each token gets a unique jti', () => {
    const token1 = generateAccessToken(testUser);
    const token2 = generateAccessToken(testUser);

    const decoded1 = jwt.decode(token1);
    const decoded2 = jwt.decode(token2);

    expect(decoded1.jti).not.toBe(decoded2.jti);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. TOKEN SERVICE — Verification
// ─────────────────────────────────────────────────────────────────────────
describe('Token Service — Verification', () => {
  test('verifyAccessToken returns decoded payload for valid token', () => {
    const token = generateAccessToken(testUser);
    const decoded = verifyAccessToken(token);

    expect(decoded.userId).toBe(testUser.userId);
    expect(decoded.email).toBe(testUser.email);
    expect(decoded.type).toBe('access');
  });

  test('verifyAccessToken throws on expired token', () => {
    // Create a token that expired 1 hour ago
    const token = jwt.sign(
      { ...buildPayload(testUser), type: 'access', jti: 'test-jti' },
      process.env.JWT_SECRET,
      { expiresIn: '-1h' }
    );

    expect(() => verifyAccessToken(token)).toThrow();

    try {
      verifyAccessToken(token);
    } catch (err) {
      expect(err.code).toBe('AUTH_TOKEN_EXPIRED');
    }
  });

  test('verifyAccessToken throws on tampered token', () => {
    const token = generateAccessToken(testUser);
    // Tamper by flipping a character
    const tampered = token.slice(0, -5) + 'XXXXX';

    expect(() => verifyAccessToken(tampered)).toThrow();

    try {
      verifyAccessToken(tampered);
    } catch (err) {
      expect(err.code).toBe('AUTH_TOKEN_MALFORMED');
    }
  });

  test('verifyAccessToken throws when given a refresh token', () => {
    const refreshToken = generateRefreshToken(testUser);

    // A refresh token signed with JWT_REFRESH_SECRET won't verify with JWT_SECRET
    expect(() => verifyAccessToken(refreshToken)).toThrow();
  });

  test('verifyRefreshToken returns decoded payload for valid token', () => {
    const token = generateRefreshToken(testUser);
    const decoded = verifyRefreshToken(token);

    expect(decoded.userId).toBe(testUser.userId);
    expect(decoded.type).toBe('refresh');
  });

  test('verifyRefreshToken throws on expired token', () => {
    const token = jwt.sign(
      { ...buildPayload(testUser), type: 'refresh', jti: 'test-jti' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '-1h' }
    );

    try {
      verifyRefreshToken(token);
      fail('Should have thrown');
    } catch (err) {
      expect(err.code).toBe('AUTH_REFRESH_EXPIRED');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. TOKEN SERVICE — Utilities
// ─────────────────────────────────────────────────────────────────────────
describe('Token Service — Utilities', () => {
  test('hashToken produces consistent SHA-256 hash', () => {
    const token = 'test-token-value';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
    expect(hash1).not.toBe(token);  // Hash is different from input
  });

  test('hashToken produces different hashes for different tokens', () => {
    const hash1 = hashToken('token-a');
    const hash2 = hashToken('token-b');

    expect(hash1).not.toBe(hash2);
  });

  test('buildPayload extracts correct user fields', () => {
    const payload = buildPayload(testUser);

    expect(payload.userId).toBe(testUser.userId);
    expect(payload.email).toBe(testUser.email);
    expect(payload.name).toBe(testUser.name);
    expect(payload.picture).toBe(testUser.picture);
    expect(payload.googleAccessToken).toBe(testUser.googleAccessToken);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. AUTH ROUTES — /auth/validate
// ─────────────────────────────────────────────────────────────────────────
describe('Auth Routes — /auth/validate', () => {
  test('GET /auth/validate returns 401 with no token', async () => {
    const res = await request(app)
      .get('/auth/validate')
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_INVALID');
    expect(res.body.error.message).toContain('No authentication token');
  });

  test('GET /auth/validate returns 401 with expired token', async () => {
    const expiredToken = jwt.sign(
      { ...buildPayload(testUser), type: 'access', jti: 'test-jti' },
      process.env.JWT_SECRET,
      { expiresIn: '-1h' }
    );

    const res = await request(app)
      .get('/auth/validate')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_TOKEN_EXPIRED');
  });

  test('GET /auth/validate returns 401 with tampered token', async () => {
    const token = generateAccessToken(testUser);
    const tampered = token.slice(0, -5) + 'XXXXX';

    const res = await request(app)
      .get('/auth/validate')
      .set('Authorization', `Bearer ${tampered}`)
      .expect(401);

    expect(res.body.error).toBeDefined();
  });

  test('GET /auth/validate returns 200 with valid token + user payload', async () => {
    const token = generateAccessToken(testUser);

    const res = await request(app)
      .get('/auth/validate')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.userId).toBe(testUser.userId);
    expect(res.body.data.email).toBe(testUser.email);
    expect(res.body.data.name).toBe(testUser.name);
    expect(res.body.data.picture).toBe(testUser.picture);
    expect(res.body.data.googleAccessToken).toBe(testUser.googleAccessToken);
  });

  test('GET /auth/validate returns 401 with malformed Authorization header', async () => {
    const res = await request(app)
      .get('/auth/validate')
      .set('Authorization', 'NotBearer token')
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_INVALID');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 5. AUTH ROUTES — /auth/me
// ─────────────────────────────────────────────────────────────────────────
describe('Auth Routes — /auth/me', () => {
  test('GET /auth/me returns user info for valid token', async () => {
    const token = generateAccessToken(testUser);

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.userId).toBe(testUser.userId);
    expect(res.body.data.email).toBe(testUser.email);
    expect(res.body.data.name).toBe(testUser.name);
    // /auth/me should NOT expose googleAccessToken
    expect(res.body.data.googleAccessToken).toBeUndefined();
  });

  test('GET /auth/me returns 401 with no token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_INVALID');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 6. AUTH ROUTES — /auth/refresh (without Redis)
// ─────────────────────────────────────────────────────────────────────────
describe('Auth Routes — /auth/refresh', () => {
  test('POST /auth/refresh returns 401 when no refresh cookie is present', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_NO_REFRESH_TOKEN');
  });

  test('POST /auth/refresh returns 401 with expired refresh cookie', async () => {
    const expiredRefresh = jwt.sign(
      { ...buildPayload(testUser), type: 'refresh', jti: 'test-jti' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '-1h' }
    );

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `orion_refresh_token=${expiredRefresh}`)
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_REFRESH_EXPIRED');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 7. AUTH ROUTES — /auth/logout
// ─────────────────────────────────────────────────────────────────────────
describe('Auth Routes — /auth/logout', () => {
  test('POST /auth/logout succeeds even without a cookie', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .expect(200);

    expect(res.body.data.message).toBe('Logged out successfully');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 8. HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────
describe('Health Check', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app)
      .get('/health')
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('auth-service');
  });
});
