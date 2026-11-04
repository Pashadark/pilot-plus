import { beforeEach, describe, expect, it, vi } from 'vitest';

const loginOwner = vi.hoisted(() => vi.fn());
vi.mock('@/modules/supa-car/auth/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/supa-car/auth/service')>();
  return { ...actual, loginOwner };
});

import { OwnerAuthError } from '@/modules/supa-car/auth/service';

import { POST } from './route';

const url = 'http://localhost/api/supa-car/v1/auth/login';

describe('POST /api/supa-car/v1/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPA_CAR_AUTH_SECRET = 'production-like-secret-with-at-least-32-bytes';
  });

  it('отклоняет невалидное тело до обращения к сервису', async () => {
    const response = await POST(
      new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: '', password: '' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(loginOwner).not.toHaveBeenCalled();
  });

  it('возвращает приватную сессию для корректного входа', async () => {
    loginOwner.mockResolvedValue({
      accessToken: 'access',
      accessTokenExpiresAt: '2026-10-15T09:15:00.000Z',
      refreshToken: 'refresh',
      owner: { id: 'owner-1', displayName: 'Павел', phoneMasked: '+7 *** ***-**-67' },
    });

    const response = await POST(
      new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone: '+7 916 123-45-67',
          password: 'надёжный пароль 2026',
          deviceName: 'Android',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual(expect.objectContaining({ accessToken: 'access' }));
  });

  it('не раскрывает причину отказа или внутреннюю ошибку', async () => {
    loginOwner.mockRejectedValueOnce(new OwnerAuthError('INVALID_CREDENTIALS', 401));
    const denied = await POST(
      new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: '+79161234567', password: 'wrong' }),
      }),
    );
    expect(denied.status).toBe(401);
    expect(await denied.json()).toEqual({ error: { code: 'INVALID_CREDENTIALS' } });

    loginOwner.mockRejectedValueOnce(new Error('database-secret'));
    const failed = await POST(
      new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: '+79161234567', password: 'wrong' }),
      }),
    );
    expect(failed.status).toBe(500);
    expect(await failed.text()).not.toContain('database-secret');
  });
});
