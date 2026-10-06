import { describe, expect, it, vi } from 'vitest';

import { bindTelegramWorkGroup } from './group-bindings';

const identity = {
  identityId: 'identity-1',
  telegramUserId: '185185047',
  kind: 'STAFF' as const,
  companyId: 'company-1',
  clientId: null,
  userId: 'user-1',
  displayName: 'Павел',
};

describe('bindTelegramWorkGroup', () => {
  it('binds a group for an active admin after fresh tenant authorization', async () => {
    const tx = {
      telegramIdentity: { findFirst: vi.fn().mockResolvedValue({ user: { role: 'MEMBER' } }) },
      companyMember: { findFirst: vi.fn().mockResolvedValue({ role: 'COMPANY_ADMIN' }) },
      telegramGroupBinding: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({
          companyId: 'company-1',
          telegramChatId: '-100123',
          title: 'СУПА ПРО',
        }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const db = { $transaction: vi.fn(async (callback) => callback(tx)) };
    await expect(
      bindTelegramWorkGroup(
        identity,
        { telegramChatId: '-100123', chatType: 'supergroup', title: 'СУПА ПРО' },
        db as never,
      ),
    ).resolves.toEqual({ companyId: 'company-1', telegramChatId: '-100123', title: 'СУПА ПРО' });
    expect(tx.telegramGroupBinding.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'company-1' } }),
    );
  });

  it('rejects clients and staff without a management role', async () => {
    await expect(
      bindTelegramWorkGroup(
        { ...identity, kind: 'CLIENT', userId: null, clientId: 'client-1' },
        { telegramChatId: '-100123', chatType: 'group' },
        {} as never,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    const tx = {
      telegramIdentity: { findFirst: vi.fn().mockResolvedValue({ user: { role: 'MEMBER' } }) },
      companyMember: { findFirst: vi.fn().mockResolvedValue({ role: 'DRIVER' }) },
    };
    const db = { $transaction: vi.fn(async (callback) => callback(tx)) };
    await expect(
      bindTelegramWorkGroup(
        identity,
        { telegramChatId: '-100123', chatType: 'group' },
        db as never,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
  });

  it('rejects private chats and groups already owned by another company', async () => {
    await expect(
      bindTelegramWorkGroup(
        identity,
        { telegramChatId: '185185047', chatType: 'private' as never },
        {} as never,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 400 });
    const tx = {
      telegramIdentity: { findFirst: vi.fn().mockResolvedValue({ user: { role: 'SUPER_ADMIN' } }) },
      companyMember: { findFirst: vi.fn() },
      telegramGroupBinding: { findUnique: vi.fn().mockResolvedValue({ companyId: 'company-2' }) },
    };
    const db = { $transaction: vi.fn(async (callback) => callback(tx)) };
    await expect(
      bindTelegramWorkGroup(
        identity,
        { telegramChatId: '-100123', chatType: 'group' },
        db as never,
      ),
    ).rejects.toMatchObject({ code: 'IDENTITY_CONFLICT', status: 409 });
  });
});
