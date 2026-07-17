import { describe, expect, it } from 'vitest';

import { createSessionToken, hashSessionToken } from '@/services/auth/session-token';

describe('сессионные токены', () => {
  it('создаёт разные токены размером не менее 32 байт', () => {
    const first = createSessionToken();
    const second = createSessionToken();

    expect(first.token).not.toBe(second.token);
    expect(Buffer.from(first.token, 'base64url').byteLength).toBeGreaterThanOrEqual(32);
    expect(Buffer.from(second.token, 'base64url').byteLength).toBeGreaterThanOrEqual(32);
  });

  it('возвращает SHA-256-хеш токена', () => {
    const sessionToken = createSessionToken();

    expect(sessionToken.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(sessionToken.tokenHash).toBe(hashSessionToken(sessionToken.token));
  });
});
