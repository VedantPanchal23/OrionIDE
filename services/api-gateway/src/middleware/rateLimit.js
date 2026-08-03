/**
 * Orion IDE — API Gateway Rate Limiting
 *
 * Tiers:
 *   1. Global:        300 req/min per IP (IDE makes many concurrent calls)
 *   2. Auth start:    30 req/min — Google OAuth kickoff only (abuse protection)
 *   3. Auth session:  120 req/min — exchange/refresh/me/logout/callback (login must not fail)
 *   4. Execute:       20 req/min per user
 *   5. Agent:         10 req/min per user
 */

const rateLimit = require('express-rate-limit');

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

const clientKey = (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown';

const userOrIpKey = (req) => {
  if (req.user && (req.user.id || req.user.userId)) {
    return `user:${req.user.id || req.user.userId}`;
  }
  return clientKey(req);
};

/**
 * Global baseline — IDE UI fires many parallel API calls (tree, tabs, terminal, run).
 * Dev default is higher so Strict Mode remount + explorer fan-out don't 429 the shell.
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_GLOBAL)
    || (process.env.NODE_ENV === 'production' ? 300 : 1200),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  handler: rateLimitHandler,
  skip: (req) => {
    const p = req.path || req.originalUrl || '';
    if (p === '/health' || p.endsWith('/health')) return true;
    // Terminal WS upgrades + session keepalive should not burn the global budget
    if (p.includes('/terminal/ws') || p.includes('/editor/ws')) return true;
    return false;
  },
});

/**
 * Strict limiter only for starting OAuth (credential stuffing / redirect spam).
 * Mounted only on GET /api/auth/google — NOT on exchange/refresh/callback.
 */
const authStartLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_START) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  handler: rateLimitHandler,
});

/**
 * Session auth limiter — login handoff must succeed even after a few retries.
 * Covers /api/auth/* except paths already covered by authStartLimiter when composed.
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  handler: rateLimitHandler,
  // Don't burn the login budget on failed silent refresh storms
  skip: (req) => {
    const p = req.path || '';
    // Allow high volume for refresh — AuthContext mounts fire this often in React Strict Mode
    if (req.method === 'POST' && (p === '/refresh' || p.endsWith('/refresh'))) return true;
    return false;
  },
});

const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_EXECUTE) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  handler: rateLimitHandler,
});

const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AGENT) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  handler: rateLimitHandler,
});

module.exports = {
  globalLimiter,
  authLimiter,
  authStartLimiter,
  executeLimiter,
  agentLimiter,
};
