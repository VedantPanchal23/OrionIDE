const { withRetry, isRetryable } = require('../../../shared/utils/retry');

describe('withRetry', () => {
  test('isRetryable detects 429', () => {
    expect(isRetryable({ status: 429 })).toBe(true);
    expect(isRetryable({ status: 400 })).toBe(false);
  });

  test('succeeds after transient failures', async () => {
    let n = 0;
    const result = await withRetry(async () => {
      n += 1;
      if (n < 3) {
        const err = new Error('rate limit');
        err.status = 429;
        throw err;
      }
      return 'ok';
    }, { retries: 4, baseMs: 1, maxMs: 5 });
    expect(result).toBe('ok');
    expect(n).toBe(3);
  });

  test('throws non-retryable immediately', async () => {
    await expect(
      withRetry(async () => {
        const err = new Error('bad');
        err.status = 400;
        throw err;
      }, { retries: 3, baseMs: 1 })
    ).rejects.toThrow('bad');
  });
});
