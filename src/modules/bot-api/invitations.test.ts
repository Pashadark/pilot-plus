import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { linkTelegramIdentity } from './invitations';

describe('linkTelegramIdentity', () => {
  it('consumes an unexpired client invite and binds the exact Telegram user', async () => {
    const invite = {
      id: 'invite-1',
      companyId: 'company-1',
      kind: 'CLIENT',
      targetId: 'client-1',
      createdByUserId: 'user-1',
    };
    const tx = {
      telegramInvite: {
        findFirst: vi.fn().mockResolvedValue(invite),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      client: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'client-1',
          firstName: 'Иван',
          lastName: 'Иванов',
          status: 'VERIFIED',
        }),
      },
      telegramIdentity: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'identity-1' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const database = { $transaction: vi.fn(async (callback) => callback(tx)) };

    await expect(
      linkTelegramIdentity(
        { inviteToken: 'raw-one-time-token', telegramUserId: '12345' },
        database as never,
      ),
    ).resolves.toMatchObject({ kind: 'CLIENT', clientId: 'client-1', displayName: 'Иван Иванов' });
    expect(tx.telegramInvite.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tokenHash: createHash('sha256').update('raw-one-time-token').digest('hex'),
        }),
      }),
    );
    expect(tx.telegramIdentity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ telegramUserId: '12345', clientId: 'client-1' }),
      }),
    );
  });

  it('rejects an already consumed or expired invite', async () => {
    const database = {
      $transaction: vi.fn(async (callback) =>
        callback({ telegramInvite: { findFirst: vi.fn().mockResolvedValue(null) } }),
      ),
    };
    await expect(
      linkTelegramIdentity(
        { inviteToken: 'already-used-token', telegramUserId: '999' },
        database as never,
      ),
    ).rejects.toMatchObject({ code: 'INVITE_INVALID', status: 400 });
  });
});
