/**
 * Orion IDE — API Gateway Rate Limiting
 *
 * Three tiers of rate limiting using express-rate-limit:
 *   1. Global:   100 requests per minute per IP
 *   2. Auth:     10 requests per minute per IP (login/callback abuse protection)
 *   3. Execute:  10 requests per minute per authenticated user
 *
 * Standard error format used for 429 responses.
 */

const rateLimit = require('express-rate-limit');

/**
 * Standard 429 handler that conforms to Orion's error response format.
 */
const rateLimitHandler = (req, res) => {
  res.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down.',
      details: {
        retryAfter: res.getHeader('Retry-After'),
      },
    },
  });
};

/**
 * Global rate limiter — 100 requests per minute per IP.
 * Applied to all routes as baseline protection.
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 100,                    // 100 requests per window per IP
  standardHeaders: true,       // Return RateLimit-* headers
  legacyHeaders: false,        // Disable X-RateLimit-* headers
  keyGenerator: (req) => {
    // Use X-Forwarded-For behind a reverse proxy, fall back to IP
    return req.ip || req.headers['x-forwarded-for'] || 'unknown';
  },
  handler: rateLimitHandler,
  skip: (req) => req.path === '/health', // Don't rate-limit health checks
});

/**
 * Auth route limiter — 10 requests per minute per IP.
 * Applied to /api/auth/* to prevent login/callback abuse.
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || 'unknown';
  },
  handler: rateLimitHandler,
  message: 'Too many authentication attempts',
});

/**
 * Execution route limiter — 10 requests per minute per authenticated user.
 * Applied to /api/execute/* to prevent execution abuse.
 * Falls back to IP-based limiting if no user is attached.
 */
const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use authenticated user ID if available, otherwise fall back to IP
    if (req.user && (req.user.id || req.user.userId)) {
      return `user:${req.user.id || req.user.userId}`;
    }
    return req.ip || req.headers['x-forwarded-for'] || 'unknown';
  },
  handler: rateLimitHandler,
  message: 'Too many code execution requests',
});

/**
 * Agent pipeline limiter — 5 requests per minute per user.
 * Applied to /api/agents/* to prevent LLM abuse.
 */
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user && (req.user.id || req.user.userId)) {
      return `user:${req.user.id || req.user.userId}`;
    }
    return req.ip || req.headers['x-forwarded-for'] || 'unknown';
  },
  handler: rateLimitHandler,
  message: 'Too many agent pipeline requests',
});

module.exports = {
  globalLimiter,
  authLimiter,
  executeLimiter,
  agentLimiter,
};
