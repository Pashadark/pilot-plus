import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticate, link } = vi.hoisted(() => ({ authenticate: vi.fn(), link: vi.fn() }));
vi.mock('@/modules/bot-api/auth', async (original) => ({
  ...(await original()),
  authenticateBotRequest: authenticate,
}));
vi.mock('@/modules/bot-api/invitations', () => ({ linkTelegramIdentity: link }));

import { POST } from './route';
import { BotApiError } from '@/modules/bot-api/auth';

describe('POST /api/bot/v1/link', () => {
  beforeEach(() => {
    authenticate.mockReset().mockResolvedValue({ service: 'TELEGRAM_BOT' });
    link.mockReset().mockResolvedValue({
      kind: 'CLIENT',
      companyId: 'company-1',
      clientId: 'client-1',
      userId: null,
      displayName: 'Иван Иванов',
    });
  });

  it('authenticates, validates and returns a no-store safe profile', async () => {
    const response = await POST(
      new Request('http://localhost/api/bot/v1/link', {
        method: 'POST',
        headers: { authorization: 'Bearer service', 'content-type': 'application/json' },
        body: JSON.stringify({ inviteToken: '1234567890123456', telegramUserId: '12345' }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual(
      expect.objectContaining({ kind: 'CLIENT', clientId: 'client-1' }),
    );
    expect(link).toHaveBeenCalledWith({ inviteToken: '1234567890123456', telegramUserId: '12345' });
  });

  it('never echoes an invalid invite token', async () => {
    const secret = 'secret-that-must-not-be-returned';
    authenticate.mockRejectedValueOnce(new BotApiError('UNAUTHORIZED', 401));
    const response = await POST(
      new Request('http://localhost/api/bot/v1/link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inviteToken: secret, telegramUserId: '12345' }),
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain(secret);
  });
});
