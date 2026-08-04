import { describe, expect, it } from 'vitest';

import { decryptField } from '@/services/security/field-encryption';

import { seedDemoClients, type ClientSeedDatabase } from './seed';

type UpsertArguments = {
  where: { companyId_phoneIndex: { companyId: string; phoneIndex: string } };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};

function createClientSeedDatabase() {
  const clients = new Map<string, Record<string, unknown>>();
  const calls: UpsertArguments[] = [];

  return {
    clients,
    calls,
    database: {
      client: {
        async upsert(arguments_: UpsertArguments) {
          calls.push(arguments_);
          const { companyId, phoneIndex } = arguments_.where.companyId_phoneIndex;
          const key = `${companyId}:${phoneIndex}`;
          const client = {
            id: `client-${clients.size + 1}`,
            ...arguments_.create,
            ...arguments_.update,
          };
          clients.set(key, client);
          return client;
        },
      },
    } as unknown as ClientSeedDatabase,
  };
}

const encryptionKey = Buffer.alloc(32, 31).toString('base64');
const searchKey = 'client-demo-search-key-for-tests';

describe('seed демонстрационных клиентов', () => {
  it('идемпотентно создаёт шесть явно тестовых клиентов с разными статусами и каналами связи', async () => {
    const fake = createClientSeedDatabase();

    const first = await seedDemoClients(fake.database, 'pilot-demo-company', 'admin-user', {
      encryptionKey,
      searchKey,
    });
    const second = await seedDemoClients(fake.database, 'pilot-demo-company', 'admin-user', {
      encryptionKey,
      searchKey,
    });

    expect(first).toEqual({ clients: 6 });
    expect(second).toEqual(first);
    expect(fake.clients).toHaveLength(6);
    expect(new Set([...fake.clients.values()].map((client) => client.phoneIndex)).size).toBe(6);
    expect(new Set([...fake.clients.values()].map((client) => client.status))).toEqual(
      new Set(['DRAFT', 'NEW', 'VERIFYING', 'VERIFIED', 'REGULAR', 'BLOCKED']),
    );
    expect(
      [...fake.clients.values()].map((client) => client.driverLicenseExpiresAt).filter(Boolean),
    ).toHaveLength(5);
    expect(
      [...fake.clients.values()].some((client) => typeof client.telegramUsername === 'string'),
    ).toBe(true);
    expect(
      [...fake.clients.values()].some(
        (client) => !client.telegramUsername && typeof client.maxUserId === 'string',
      ),
    ).toBe(true);
    expect(
      fake.calls.every(
        ({ create, update }) =>
          Array.isArray(create.driverCategories) && Array.isArray(update.driverCategories),
      ),
    ).toBe(true);
  });

  it('сохраняет номера и документы только в зашифрованном виде', async () => {
    const fake = createClientSeedDatabase();

    await seedDemoClients(fake.database, 'pilot-demo-company', 'admin-user', {
      encryptionKey,
      searchKey,
    });

    for (const client of fake.clients.values()) {
      expect(client.phoneEncrypted).toMatch(/^v1\./);
      expect(client.phoneEncrypted).not.toContain('7999000');
      expect(decryptField(client.phoneEncrypted as string, encryptionKey)).toMatch(/^7\d{10}$/);
      if (client.passportEncrypted) expect(client.passportEncrypted).not.toContain('DEMO');
      if (client.driverLicenseEncrypted)
        expect(client.driverLicenseEncrypted).not.toContain('DEMO');
      expect(client.source).toBe('demo-fixture');
      expect(client.email).toMatch(/@example\.test$/);
    }
  });
});
