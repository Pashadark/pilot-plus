import { describe, expect, it } from 'vitest';

import { hashPassword } from '@/services/auth/password';

import { OwnerAuthError, loginOwner, type OwnerAuthRepository } from './service';

const secret = 'supa-car-test-secret-with-at-least-32-bytes';
const now = new Date('2026-10-15T09:00:00.000Z');

function repository(
  owner: Awaited<ReturnType<OwnerAuthRepository['findByPhone']>>,
): OwnerAuthRepository & { created: Array<Record<string, unknown>> } {
  const created: Array<Record<string, unknown>> = [];
  return {
    created,
    async findByPhone() {
      return owner;
    },
    async createSession(input) {
      created.push(input);
      return { id: 'session-1' };
    },
  };
}

describe('вход владельца SUPA CAR', () => {
  it('входит по нормализованному телефону и сохраняет только хэш refresh-токена', async () => {
    const repo = repository({
      id: 'owner-1',
      displayName: 'Павел Седов',
      phoneE164: '+79161234567',
      passwordHash: await hashPassword('надёжный пароль 2026'),
      status: 'ACTIVE',
    });

    const result = await loginOwner(
      { phone: '8 (916) 123-45-67', password: 'надёжный пароль 2026', deviceName: 'Android' },
      repo,
      secret,
      now,
    );

    expect(result.owner).toEqual({
      id: 'owner-1',
      displayName: 'Павел Седов',
      phoneMasked: '+7 *** ***-**-67',
    });
    expect(result.accessToken).toContain('.');
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(repo.created[0]?.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(repo.created[0]?.refreshTokenHash).not.toBe(result.refreshToken);
  });

  it('не раскрывает причину отказа', async () => {
    const passwordHash = await hashPassword('правильный пароль 2026');
    const cases = [
      { owner: null, password: 'любой пароль' },
      {
        owner: {
          id: 'owner-1',
          displayName: 'Павел',
          phoneE164: '+79161234567',
          passwordHash,
          status: 'ACTIVE' as const,
        },
        password: 'неправильный пароль',
      },
      {
        owner: {
          id: 'owner-1',
          displayName: 'Павел',
          phoneE164: '+79161234567',
          passwordHash,
          status: 'BLOCKED' as const,
        },
        password: 'правильный пароль 2026',
      },
    ];

    for (const { owner, password } of cases) {
      await expect(
        loginOwner({ phone: '+7 916 123-45-67', password }, repository(owner), secret, now),
      ).rejects.toEqual(new OwnerAuthError('INVALID_CREDENTIALS', 401));
    }
  });
});
