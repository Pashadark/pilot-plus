import { describe, expect, it } from 'vitest';

import { authenticateOwnerRequest, type OwnerAccessRepository } from './access';
import { OwnerAuthError } from './service';
import { issueAccessToken } from './session';

const secret = 'supa-car-test-secret-with-at-least-32-bytes';
const now = new Date('2026-10-15T09:00:00.000Z');

function request(token?: string) {
  return new Request('http://localhost/api/supa-car/v1/me', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('доступ владельца SUPA CAR', () => {
  it('возвращает активного владельца только для живой сессии', async () => {
    const token = issueAccessToken(
      { ownerProfileId: 'owner-1', sessionId: 'session-1' },
      secret,
      now.getTime(),
    ).token;
    const repository: OwnerAccessRepository = {
      async findActiveSession(input) {
        expect(input).toEqual({
          sessionId: 'session-1',
          ownerProfileId: 'owner-1',
          now,
        });
        return {
          id: 'owner-1',
          companyId: 'company-1',
          displayName: 'Павел',
          phoneE164: '+79161234567',
        };
      },
    };

    await expect(
      authenticateOwnerRequest(request(token), repository, secret, now),
    ).resolves.toEqual(expect.objectContaining({ id: 'owner-1', companyId: 'company-1' }));
  });

  it.each([undefined, 'broken'])(
    'одинаково отклоняет отсутствующий или неверный токен',
    async (token) => {
      const repository: OwnerAccessRepository = {
        async findActiveSession() {
          return null;
        },
      };

      await expect(
        authenticateOwnerRequest(request(token), repository, secret, now),
      ).rejects.toEqual(new OwnerAuthError('UNAUTHORIZED', 401));
    },
  );
});
