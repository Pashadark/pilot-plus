import { describe, expect, it } from 'vitest';

import {
  ACCESS_TOKEN_TTL_MS,
  issueAccessToken,
  prepareRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
} from './session';

const secret = 'supa-car-test-secret-with-at-least-32-bytes';
const now = Date.UTC(2026, 9, 15, 9, 0, 0);

describe('мобильная сессия SUPA CAR', () => {
  it('выпускает короткоживущий access-токен с привязкой к сессии', () => {
    const issued = issueAccessToken(
      { ownerProfileId: 'owner-1', sessionId: 'session-1' },
      secret,
      now,
    );

    expect(issued.expiresAt.getTime()).toBe(now + ACCESS_TOKEN_TTL_MS);
    expect(verifyAccessToken(issued.token, secret, now + 1)).toEqual({
      ownerProfileId: 'owner-1',
      sessionId: 'session-1',
    });
  });

  it('отклоняет изменённый и истёкший access-токен', () => {
    const issued = issueAccessToken(
      { ownerProfileId: 'owner-1', sessionId: 'session-1' },
      secret,
      now,
    );

    expect(verifyAccessToken(`${issued.token}x`, secret, now + 1)).toBeNull();
    expect(verifyAccessToken(issued.token, secret, now + ACCESS_TOKEN_TTL_MS)).toBeNull();
  });

  it('готовит непрозрачный refresh-токен и хранит только его SHA-256 хэш', () => {
    const refresh = prepareRefreshToken();

    expect(refresh.token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(refresh.tokenHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(refresh.tokenHash).not.toContain(refresh.token);
    expect(hashRefreshToken(refresh.token)).toBe(refresh.tokenHash);
  });

  it('не принимает короткий секрет подписи', () => {
    expect(() =>
      issueAccessToken({ ownerProfileId: 'owner-1', sessionId: 'session-1' }, 'short', now),
    ).toThrow('SUPA CAR auth secret must contain at least 32 characters.');
  });
});
