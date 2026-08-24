import { describe, expect, it, vi } from 'vitest';

import { encryptField } from '@/services/security/field-encryption';

import { createDashboardQueries } from './queries';

vi.mock('@/database/prisma/client', () => ({
  prisma: {
    companyMember: { findFirst: vi.fn() },
    vehicle: { findMany: vi.fn() },
    rental: { findMany: vi.fn() },
    maintenanceRecord: { findMany: vi.fn() },
    washRecord: { findMany: vi.fn() },
  },
}));

const NOW = new Date('2026-08-24T09:00:00.000Z');
const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

function repositoryFixture() {
  return {
    vehicleFindMany: vi.fn().mockResolvedValue([
      {
        id: 'vehicle-1',
        make: 'Kia',
        model: 'Rio',
        registrationNumber: 'A001AA777',
        archivedAt: null,
        isDemoImport: false,
        positions: [{ recordedAt: NOW }],
      },
    ]),
    rentalFindMany: vi.fn().mockResolvedValue([]),
    maintenanceFindMany: vi.fn().mockResolvedValue([]),
    washFindMany: vi.fn().mockResolvedValue([]),
  };
}

describe('dashboard server queries', () => {
  it('scopes every source to the same authenticated company', async () => {
    const repository = repositoryFixture();

    await createDashboardQueries(
      repository,
      async () => ({ companyId: 'company-1', canViewClientPhone: true }),
      { encryptionKey: ENCRYPTION_KEY },
    ).getOverview('today', NOW);

    for (const query of [
      repository.vehicleFindMany,
      repository.rentalFindMany,
      repository.maintenanceFindMany,
      repository.washFindMany,
    ]) {
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-1' }) }),
      );
    }
    expect(repository.vehicleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ archivedAt: null, isDemoImport: false }),
      }),
    );
    expect(repository.maintenanceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scheduledAt: {
            gte: new Date('2026-08-23T21:00:00.000Z'),
            lt: new Date('2026-08-24T21:00:00.000Z'),
          },
        }),
      }),
    );
    expect(repository.washFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scheduledAt: {
            gte: new Date('2026-08-23T21:00:00.000Z'),
            lt: new Date('2026-08-24T21:00:00.000Z'),
          },
        }),
      }),
    );
  });

  it('rejects an unauthenticated request before reading dashboard data', async () => {
    const repository = repositoryFixture();

    await expect(
      createDashboardQueries(repository, async () => null, {
        encryptionKey: ENCRYPTION_KEY,
      }).getOverview('today'),
    ).rejects.toThrow('Доступ к панели управления запрещён.');

    expect(repository.vehicleFindMany).not.toHaveBeenCalled();
    expect(repository.rentalFindMany).not.toHaveBeenCalled();
    expect(repository.maintenanceFindMany).not.toHaveBeenCalled();
    expect(repository.washFindMany).not.toHaveBeenCalled();
  });

  it('decrypts a client phone only for an authorized caller and never returns ciphertext', async () => {
    const encryptedPhone = encryptField('+79990000000', ENCRYPTION_KEY);
    const repository = repositoryFixture();
    repository.rentalFindMany.mockResolvedValue([
      {
        id: 'rental-1',
        vehicleId: 'vehicle-1',
        status: 'CONFIRMED',
        startsAt: new Date('2026-08-24T10:00:00.000Z'),
        endsAt: new Date('2026-08-24T18:00:00.000Z'),
        completedAt: null,
        totalPriceMinor: BigInt(40_000),
        depositMinor: null,
        contractNumber: 'R-1',
        client: {
          firstName: 'Иван',
          middleName: null,
          lastName: 'Иванов',
          phoneEncrypted: encryptedPhone,
        },
        vehicle: { make: 'Kia', model: 'Rio', registrationNumber: 'A001AA777' },
        operations: [],
      },
    ]);

    const authorized = await createDashboardQueries(
      repository,
      async () => ({ companyId: 'company-1', canViewClientPhone: true }),
      { encryptionKey: ENCRYPTION_KEY },
    ).getOverview('today', NOW);
    const unauthorized = await createDashboardQueries(
      repository,
      async () => ({ companyId: 'company-1', canViewClientPhone: false }),
      { encryptionKey: ENCRYPTION_KEY },
    ).getOverview('today', NOW);

    expect(authorized.workItems[0]?.phone).toBe('+79990000000');
    expect(unauthorized.workItems[0]?.phone).toBeNull();
    expect(JSON.stringify(authorized)).not.toContain(encryptedPhone);
    expect(JSON.stringify(unauthorized)).not.toContain(encryptedPhone);
  });
});
