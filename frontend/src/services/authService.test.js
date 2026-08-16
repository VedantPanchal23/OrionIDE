import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => {
  const api = {
    post: vi.fn(),
    get: vi.fn(),
  };
  return {
    default: api,
    setAccessToken: vi.fn(),
    getAccessToken: vi.fn(),
  };
});

import api, { setAccessToken } from './api';
import {
  exchangeAuthCode, fetchMe, logout, refreshAccessToken,
} from './authService';

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exchangeAuthCode stores access token', async () => {
    api.post.mockResolvedValue({ data: { data: { accessToken: 'tok-1' } } });
    const data = await exchangeAuthCode('code-abc');
    expect(api.post).toHaveBeenCalledWith('/auth/exchange', { code: 'code-abc' });
    expect(setAccessToken).toHaveBeenCalledWith('tok-1');
    expect(data.accessToken).toBe('tok-1');
  });

  it('refreshAccessToken returns token', async () => {
    api.post.mockResolvedValue({ data: { data: { accessToken: 'tok-2' } } });
    await expect(refreshAccessToken()).resolves.toBe('tok-2');
  });

  it('fetchMe returns profile payload', async () => {
    api.get.mockResolvedValue({ data: { data: { id: 'u1', email: 'a@b.c', planId: 'free' } } });
    const me = await fetchMe();
    expect(api.get).toHaveBeenCalledWith('/auth/me');
    expect(me.email).toBe('a@b.c');
  });

  it('logout clears token even if request fails', async () => {
    api.post.mockRejectedValue(new Error('network'));
    await expect(logout()).rejects.toThrow('network');
    expect(setAccessToken).toHaveBeenCalledWith(null);
  });
});
