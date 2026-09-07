import { beforeEach, describe, expect, it, vi } from 'vitest';

import { encryptField } from '@/services/security/field-encryption';

const repository = vi.hoisted(() => ({
  lead: { findMany: vi.fn() },
  company: { findMany: vi.fn() },
}));

vi.mock('@/database/prisma/client', () => ({ prisma: repository }));

import { listLeads } from './queries';

const encryptionKey = Buffer.alloc(32, 31).toString('base64');
process.env.CLIENT_DATA_ENCRYPTION_KEY = encryptionKey;

const access = {
  user: {
    id: 'user-1',
    email: 'dispatcher@example.com',
    name: 'Диспетчер',
    role: 'MEMBER' as const,
    canAccessAdmin: false,
  },
  scope: 'COMPANY' as const,
  companyIds: ['company-1'],
  canManage: true,
};

describe('lead queries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns surname and the optional next-contact time inside the permitted tenant', async () => {
    repository.lead.findMany.mockResolvedValue([
      {
        id: 'lead-1',
        name: 'Анна',
        lastName: 'Петрова',
        phoneEncrypted: encryptField('+7 999 123-45-67', encryptionKey),
        source: 'Авито',
        commentEncrypted: null,
        status: 'NEW',
        nextContactAt: new Date('2026-09-07T12:00:00.000Z'),
        createdAt: new Date('2026-09-07T08:00:00.000Z'),
        company: { name: 'СУПА ПРО' },
        assignedTo: { name: 'Павел Седов' },
      },
    ]);

    const [item] = await listLeads(access);

    expect(repository.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: { in: ['company-1'] } },
        select: expect.objectContaining({ lastName: true, nextContactAt: true }),
      }),
    );
    expect(item).toMatchObject({
      lastName: 'Петрова',
      nextContactAt: '2026-09-07T12:00:00.000Z',
    });
  });
});
