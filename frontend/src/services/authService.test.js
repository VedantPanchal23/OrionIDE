import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exchangeAuthCode, exchangeAuthCodeOnce, loginWithGoogle } from './authService';

describe('authService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('exchangeAuthCode posts code and returns accessToken', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { accessToken: 'jwt-123' } }),
    }));

    const token = await exchangeAuthCode('one-time-code');
    expect(token).toBe('jwt-123');
    expect(fetch).toHaveBeenCalledWith('/api/auth/exchange', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'one-time-code' }),
    });
  });

  it('exchangeAuthCode throws on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Auth code is invalid' } }),
    }));

    await expect(exchangeAuthCode('bad')).rejects.toThrow('Auth code is invalid');
  });

  it('exchangeAuthCodeOnce dedupes concurrent calls for the same code', async () => {
    let resolveFetch;
    const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
    const fetchMock = vi.fn().mockReturnValue(fetchPromise);
    vi.stubGlobal('fetch', fetchMock);

    const p1 = exchangeAuthCodeOnce('same-code');
    const p2 = exchangeAuthCodeOnce('same-code');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch({
      ok: true,
      json: async () => ({ data: { accessToken: 'jwt-once' } }),
    });

    await expect(Promise.all([p1, p2])).resolves.toEqual(['jwt-once', 'jwt-once']);
    expect(sessionStorage.getItem('orion_access_token')).toBe('jwt-once');
  });

  it('loginWithGoogle redirects to Google OAuth', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' },
      writable: true,
    });
    loginWithGoogle();
    expect(window.location.href).toBe('/api/auth/google');
  });
});
