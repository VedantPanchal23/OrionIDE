import { describe, expect, it } from 'vitest';
import { formatApiError, isPlanError } from '../utils/apiError';

describe('formatApiError', () => {
  it('formats PLAN_LIMIT_EXECUTE', () => {
    const msg = formatApiError({
      response: {
        data: {
          error: {
            code: 'PLAN_LIMIT_EXECUTE',
            message: 'limit',
            details: { count: 10, limit: 10 },
          },
        },
      },
    });
    expect(msg).toContain('Execution limit');
    expect(msg).toContain('10/10');
  });

  it('formats PLAN_FEATURE_LOCKED', () => {
    const msg = formatApiError({
      response: {
        data: {
          error: {
            code: 'PLAN_FEATURE_LOCKED',
            message: 'Agents locked',
            details: { reason: 'AGENTS_PRO_ONLY' },
          },
        },
      },
    });
    expect(msg).toContain('AGENTS_PRO_ONLY');
  });

  it('falls back to message', () => {
    expect(formatApiError({ message: 'boom' })).toBe('boom');
  });

  it('detects plan errors', () => {
    expect(isPlanError({
      response: { data: { error: { code: 'PLAN_LIMIT_AGENT' } } },
    })).toBe(true);
    expect(isPlanError({ response: { data: { error: { code: 'OTHER' } } } })).toBe(false);
  });
});
