/**
 * Orion IDE — Shared CORS Configuration
 *
 * Used by ALL services to ensure consistent CORS handling.
 * credentials: true requires explicit origin (no wildcard *).
 */

const corsConfig = {
  origin: (origin, callback) => {
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:3010',
      'http://localhost:3000',
    ].filter(Boolean);

    // No origin = same-origin or non-browser (curl, server-to-server)
    if (!origin) return callback(null, true);

    // Normalize: remove trailing slash for comparison
    const normalized = origin.replace(/\/+$/, '');
    if (allowed.includes(normalized)) return callback(null, true);

    // Also check the raw origin in case it matches exactly
    if (allowed.includes(origin)) return callback(null, true);

    return callback(null, false); // Don't throw — just reject silently
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-User-Id', 'X-User-Email'],
};

module.exports = corsConfig;
