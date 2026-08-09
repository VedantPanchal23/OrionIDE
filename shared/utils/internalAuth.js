/**
 * Orion IDE — Internal service-mesh auth helpers
 *
 * Gateway (and trusted services) must send X-Internal-Secret matching
 * INTERNAL_SECRET or DRIVE_SERVICE_SECRET. Downstream services should fail
 * closed when the secret is configured (always required outside test).
 */

function resolveServiceSecret() {
  return process.env.INTERNAL_SECRET || process.env.DRIVE_SERVICE_SECRET || '';
}

/**
 * Express middleware: require a matching internal secret.
 * @param {{ service?: string, optionalInTest?: boolean }} [opts]
 */
function requireInternalSecret(opts = {}) {
  const service = opts.service || 'service';
  const optionalInTest = opts.optionalInTest !== false;

  return (req, res, next) => {
    const isTest = process.env.NODE_ENV === 'test';
    // Unit/integration tests exercise business logic without mesh headers
    if (isTest && optionalInTest) return next();

    const expected = resolveServiceSecret();

    if (!expected) {
      return res.status(503).json({
        error: {
          code: 'SERVICE_MISCONFIGURED',
          message: `${service} requires INTERNAL_SECRET (or DRIVE_SERVICE_SECRET)`,
          details: null,
        },
      });
    }

    const provided = req.headers['x-internal-secret'] || req.headers['x-orion-service-secret'];
    if (provided !== expected) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN_INTERNAL',
          message: 'Missing or invalid service secret',
          details: null,
        },
      });
    }

    return next();
  };
}

/** True when the caller presented a matching mesh secret. */
function isInternalCaller(req) {
  const expected = resolveServiceSecret();
  if (!expected) return false;
  const provided = req.headers['x-internal-secret'] || req.headers['x-orion-service-secret'];
  return provided === expected;
}

module.exports = {
  resolveServiceSecret,
  requireInternalSecret,
  isInternalCaller,
};
