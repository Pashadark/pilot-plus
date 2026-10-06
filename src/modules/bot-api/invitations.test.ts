import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { linkTelegramIdentity } from './invitations';
import { blindIndex } from '@/services/security/field-encryption';
import { normalizeRussianPhone } from '@/shared/utils/phone';

describe('linkTelegramIdentity', () => {
  it('rejects a Telegram account linked in another company', async () => {
    const other = {
      companyId: 'other',
      telegramUserId: '12345',
      clientId: null,
      userId: 'u',
      kind: 'STAFF',
      isActive: true,
    };
    const tx = {
      telegramInvite: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 'i', companyId: 'c', kind: 'STAFF', targetId: 'u' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      companyMember: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'u', user: { name: 'Manager' } }),
      },
      telegramIdentity: {
        findFirst: vi.fn().mockResolvedValue(other),
        findMany: vi.fn().mockResolvedValue([other]),
        create: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    };
    await expect(
      linkTelegramIdentity({ inviteToken: 'test', telegramUserId: '12345' }, {
        $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
      } as never),
    ).rejects.toMatchObject({ code: 'IDENTITY_CONFLICT' });
    expect(tx.telegramInvite.updateMany).not.toHaveBeenCalled();
  });
  it('consumes an unexpired client invite and binds the exact Telegram user', async () => {
    vi.stubEnv('CLIENT_SEARCH_KEY', 'test-search-key-for-client-contact');
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
          phoneIndex: blindIndex(
            '79167176556',
            process.env.CLIENT_SEARCH_KEY!,
            normalizeRussianPhone,
          ),
        }),
      },
      telegramIdentity: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'identity-1' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const database = { $transaction: vi.fn(async (callback) => callback(tx)) };

    await expect(
      linkTelegramIdentity(
        {
          inviteToken: 'raw-one-time-token',
          telegramUserId: '12345',
          contactUserId: '12345',
          phoneNumber: '8.916.717.65.56',
        },
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

  it.each([
    [{}, 'CONTACT_REQUIRED'],
    [{ contactUserId: '999', phoneNumber: '79167176556' }, 'CONTACT_MISMATCH'],
    [{ contactUserId: '12345', phoneNumber: '79000000000' }, 'CONTACT_MISMATCH'],
  ])('does not consume a client invitation for invalid contact %j', async (contact, code) => {
    vi.stubEnv('CLIENT_SEARCH_KEY', 'test-search-key-for-client-contact');
    const tx = {
      telegramInvite: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'invite',
          companyId: 'company',
          kind: 'CLIENT',
          targetId: 'client',
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      client: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'client',
          status: 'VERIFIED',
          phoneIndex: blindIndex(
            '79167176556',
            process.env.CLIENT_SEARCH_KEY!,
            normalizeRussianPhone,
          ),
        }),
      },
      telegramIdentity: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    await expect(
      linkTelegramIdentity(
        { inviteToken: 'raw-one-time-token', telegramUserId: '12345', ...contact },
        { $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) } as never,
      ),
    ).rejects.toMatchObject({ code });
    expect(tx.telegramInvite.updateMany).not.toHaveBeenCalled();
    expect(tx.telegramIdentity.create).not.toHaveBeenCalled();
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
