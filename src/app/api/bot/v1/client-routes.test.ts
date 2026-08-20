import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), resolve: vi.fn(), list: vi.fn() }));
vi.mock('@/modules/bot-api/auth', async (original) => ({
  ...(await original()),
  authenticateBotRequest: mocks.auth,
}));
vi.mock('@/modules/bot-api/queries', () => ({
  resolveBotIdentity: mocks.resolve,
  listClientRentals: mocks.list,
}));

import { GET as getMe } from './me/route';
import { GET as getRentals } from './rentals/route';

describe('Telegram client routes', () => {
  beforeEach(() => {
    mocks.auth.mockReset().mockResolvedValue({ service: 'TELEGRAM_BOT' });
    mocks.resolve
      .mockReset()
      .mockResolvedValue({ identityId: 'i1', kind: 'CLIENT', companyId: 'c1', clientId: 'cl1' });
    mocks.list.mockReset().mockResolvedValue([{ id: 'r1' }]);
  });

  it('requires Telegram identity and always disables caching', async () => {
    const response = await getMe(
      new Request('http://localhost/api/bot/v1/me', {
        headers: { authorization: 'Bearer service' },
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('passes only the server-resolved identity into rental listing', async () => {
    const response = await getRentals(
      new Request('http://localhost/api/bot/v1/rentals', {
        headers: { authorization: 'Bearer service', 'x-telegram-user-id': '12345' },
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.resolve).toHaveBeenCalledWith('12345');
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'c1', clientId: 'cl1' }),
    );
    expect(await response.json()).toEqual({ items: [{ id: 'r1' }] });
  });
});
