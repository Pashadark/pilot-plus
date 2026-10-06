import { expect, it, vi } from 'vitest';
import { linkClientContact } from './contact-authorization';

const input = { telegramUserId: '123', contactUserId: '123', phoneNumber: '79167176556' };
it('rejects multiple matching identities even when the first is valid', async () => {
  vi.stubEnv('CLIENT_SEARCH_KEY', 'search-test-key');
  const { tx, db } = database([{ id: 'client', companyId: 'company' }]);
  const valid = {
    companyId: 'company',
    clientId: 'client',
    kind: 'CLIENT',
    telegramUserId: '123',
    isActive: true,
  };
  Object.assign(tx.telegramIdentity, {
    findMany: vi.fn().mockResolvedValue([valid, { ...valid, companyId: 'other' }]),
  });
  await expect(linkClientContact(input, db as never)).rejects.toMatchObject({
    code: 'MANAGER_REVIEW_REQUIRED',
  });
});
function database(clients: unknown[]) {
  const tx = {
    client: { findMany: vi.fn().mockResolvedValue(clients) },
    telegramIdentity: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { tx, db: { $transaction: async (work: (value: typeof tx) => unknown) => work(tx) } };
}
it.each([{ clients: [] }, { clients: [{ id: 'one' }, { id: 'two' }] }])(
  'does not auto-link missing or ambiguous client',
  async ({ clients }) => {
    vi.stubEnv('CLIENT_SEARCH_KEY', 'search-test-key');
    const { tx, db } = database(clients);
    await expect(linkClientContact(input, db as never)).rejects.toMatchObject({
      code: 'MANAGER_REVIEW_REQUIRED',
    });
    expect(tx.telegramIdentity.create).not.toHaveBeenCalled();
  },
);
it('links only an unambiguous client with a current rental', async () => {
  vi.stubEnv('CLIENT_SEARCH_KEY', 'search-test-key');
  const { tx, db } = database([
    {
      id: 'client',
      companyId: 'company',
      firstName: 'Иван',
      lastName: 'Иванов',
      createdByUserId: 'manager',
    },
  ]);
  await expect(linkClientContact(input, db as never)).resolves.toMatchObject({
    kind: 'CLIENT',
    clientId: 'client',
    companyId: 'company',
  });
  expect(tx.client.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      take: 2,
      where: expect.objectContaining({
        rentals: { some: { status: { in: ['CONFIRMED', 'ACTIVE'] } } },
      }),
    }),
  );
});
it('never accepts someone else contact', async () => {
  const { tx, db } = database([]);
  await expect(
    linkClientContact({ ...input, contactUserId: '456' }, db as never),
  ).rejects.toMatchObject({ code: 'CONTACT_MISMATCH' });
  expect(tx.client.findMany).not.toHaveBeenCalled();
});

it.each([
  {
    isActive: false,
    companyId: 'company',
    clientId: 'client',
    kind: 'CLIENT',
    telegramUserId: '123',
  },
  { isActive: true, companyId: 'other', clientId: 'client', kind: 'CLIENT', telegramUserId: '123' },
  {
    isActive: true,
    companyId: 'company',
    clientId: 'client',
    kind: 'CLIENT',
    telegramUserId: '456',
  },
])('does not overwrite a disabled or conflicting identity', async (existing) => {
  vi.stubEnv('CLIENT_SEARCH_KEY', 'search-test-key');
  const { tx, db } = database([{ id: 'client', companyId: 'company' }]);
  tx.telegramIdentity.findMany.mockResolvedValue([existing]);
  await expect(linkClientContact(input, db as never)).rejects.toMatchObject({
    code: 'MANAGER_REVIEW_REQUIRED',
  });
  expect(tx.telegramIdentity.create).not.toHaveBeenCalled();
});
