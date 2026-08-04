import { describe, expect, it } from 'vitest';

import { encryptField } from '@/services/security/field-encryption';

import { createClientQueries } from './queries';

const encryptionKey = Buffer.alloc(32, 7).toString('base64');

const access = {
  user: {
    id: 'user-1',
    email: 'dispatcher@example.com',
    name: 'Диспетчер',
    role: 'MEMBER' as const,
    canAccessAdmin: false,
  },
  scope: 'COMPANY' as const,
  companyIds: ['c1'],
  canManage: true,
};

const rawClient = {
  id: 'client-1',
  companyId: 'c1',
  firstName: 'Анна',
  middleName: 'Сергеевна',
  lastName: 'Воронова',
  birthDate: new Date('1990-04-12T00:00:00.000Z'),
  phoneEncrypted: encryptField('79991234567', encryptionKey),
  email: 'anna@example.com',
  passportEncrypted: encryptField('4510 123456', encryptionKey),
  driverLicenseEncrypted: encryptField('9910 654321', encryptionKey),
  driverLicenseIssuedAt: new Date('2020-01-01T00:00:00.000Z'),
  driverLicenseExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
  status: 'VERIFIED' as const,
  createdAt: new Date('2026-08-01T10:00:00.000Z'),
  updatedAt: new Date('2026-08-02T10:00:00.000Z'),
};

function createRepository() {
  const findMany = async (args: unknown) => {
    calls.findMany = args;
    return [rawClient];
  };
  const findFirst = async (args: unknown) => {
    calls.findFirst = args;
    return rawClient;
  };
  const calls: { findMany?: unknown; findFirst?: unknown } = {};
  return { calls, repository: { findMany, findFirst } };
}

describe('tenant-scoped client queries', () => {
  it('limits cards to permitted non-archived clients and never exposes ciphertext', async () => {
    const fake = createRepository();
    const queries = createClientQueries(fake.repository, { encryptionKey });

    const result = await queries.getClients(access, { status: 'VERIFIED', page: 1, pageSize: 24 });

    expect(fake.calls.findMany).toMatchObject({
      where: { companyId: { in: ['c1'] }, archivedAt: null, status: 'VERIFIED' },
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'client-1',
      fullName: 'Воронова Анна Сергеевна',
      phoneMasked: '+7 ••• •••-45-67',
      passportMasked: '45•• •••456',
      driverLicenseMasked: '99•• •••321',
      updatedAt: '2026-08-02T10:00:00.000Z',
    });
    expect(result.items[0]).not.toHaveProperty('phoneEncrypted');
    expect(result.items[0]).not.toHaveProperty('passportEncrypted');
    expect(result.items[0]).not.toHaveProperty('driverLicenseEncrypted');
  });

  it('decrypts plaintext contact and document fields only for the authorized detail DTO', async () => {
    const fake = createRepository();
    const queries = createClientQueries(fake.repository, { encryptionKey });

    const result = await queries.getClientById(access, 'client-1');

    expect(fake.calls.findFirst).toMatchObject({
      where: { id: 'client-1', companyId: { in: ['c1'] }, archivedAt: null },
    });
    expect(result).toMatchObject({
      id: 'client-1',
      phone: '79991234567',
      passport: '4510 123456',
      driverLicense: '9910 654321',
      birthDate: '1990-04-12T00:00:00.000Z',
    });
    expect(result).not.toHaveProperty('passportEncrypted');
  });

  it('returns null when the requested client is outside the tenant scope', async () => {
    const repository = {
      async findMany() {
        return [];
      },
      async findFirst() {
        return null;
      },
    };
    const queries = createClientQueries(repository, { encryptionKey });

    await expect(queries.getClientById(access, 'foreign-client')).resolves.toBeNull();
  });
});
