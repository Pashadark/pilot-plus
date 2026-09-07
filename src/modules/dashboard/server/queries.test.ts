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
    operationsTask: { findMany: vi.fn() },
    lead: { findMany: vi.fn() },
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
    taskFindMany: vi.fn().mockResolvedValue([]),
    leadFindMany: vi.fn().mockResolvedValue([]),
  };
}

describe('dashboard server queries', () => {
  it('loads lifetime finance rentals without the selected dashboard window', async () => {
    const repository = repositoryFixture();

    await createDashboardQueries(
      repository,
      async () => ({ companyId: 'company-1', canViewClientPhone: false }),
      { encryptionKey: ENCRYPTION_KEY },
    ).getOverview('today', NOW);

    expect(repository.rentalFindMany).toHaveBeenCalledTimes(2);
    expect(repository.rentalFindMany.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        where: {
          companyId: 'company-1',
          status: { in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] },
        },
      }),
    );
  });

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
      repository.taskFindMany,
      repository.leadFindMany,
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
    expect(repository.taskFindMany).not.toHaveBeenCalled();
    expect(repository.leadFindMany).not.toHaveBeenCalled();
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

    const authorizedQuery = repository.rentalFindMany.mock.calls[0]?.[0];
    const unauthorizedQuery = repository.rentalFindMany.mock.calls[2]?.[0];

    expect(authorized.workItems[0]?.phone).toBe('+79990000000');
    expect(unauthorized.workItems[0]?.phone).toBeNull();
    expect(JSON.stringify(authorized)).not.toContain(encryptedPhone);
    expect(JSON.stringify(unauthorized)).not.toContain(encryptedPhone);
    expect(authorizedQuery).toHaveProperty('select.client.select.phoneEncrypted', true);
    expect(unauthorizedQuery).not.toHaveProperty('select.client.select.phoneEncrypted');
  });

  it('does not truncate committed operations needed for deposit and return state', async () => {
    const repository = repositoryFixture();

    await createDashboardQueries(
      repository,
      async () => ({ companyId: 'company-1', canViewClientPhone: false }),
      { encryptionKey: ENCRYPTION_KEY },
    ).getOverview('today', NOW);

    expect(repository.rentalFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          operations: expect.objectContaining({
            where: { status: 'COMMITTED' },
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            select: expect.objectContaining({
              type: true,
              occurredAt: true,
              depositStatus: true,
              fulfillmentMethod: true,
              fulfillmentAddress: true,
            }),
          }),
        }),
      }),
    );

    const operations = repository.rentalFindMany.mock.calls[0]?.[0]?.select?.operations;
    expect(operations).not.toHaveProperty('take');
  });

  it('loads active rentals that ended before the selected day so overdue returns stay visible', async () => {
    const repository = repositoryFixture();

    await createDashboardQueries(
      repository,
      async () => ({ companyId: 'company-1', canViewClientPhone: false }),
      { encryptionKey: ENCRYPTION_KEY },
    ).getOverview('today', NOW);

    expect(repository.rentalFindMany.mock.calls[0]?.[0]?.where).toMatchObject({
      companyId: 'company-1',
      OR: expect.arrayContaining([
        {
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          startsAt: { lt: new Date('2026-08-24T21:00:00.000Z') },
        },
      ]),
    });
  });

  it('loads active leads for the workday and decrypts their phones only when permitted', async () => {
    const encryptedPhone = encryptField('+79991112233', ENCRYPTION_KEY);
    const repository = repositoryFixture();
    repository.leadFindMany.mockResolvedValue([
      {
        id: 'lead-1',
        name: 'Анна',
        lastName: 'Петрова',
        source: 'ВКонтакте',
        status: 'CONTACTED',
        nextContactAt: null,
        createdAt: new Date('2026-08-24T08:00:00.000Z'),
        phoneEncrypted: encryptedPhone,
        assignedTo: { name: 'Павел Седов' },
      },
    ]);

    const overview = await createDashboardQueries(
      repository,
      async () => ({ companyId: 'company-1', canViewClientPhone: true }),
      { encryptionKey: ENCRYPTION_KEY },
    ).getOverview('today', NOW);

    expect(repository.leadFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-1',
          status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] },
        }),
      }),
    );
    expect(repository.leadFindMany.mock.calls[0]?.[0]).toHaveProperty(
      'select.phoneEncrypted',
      true,
    );
    expect(overview.workItems).toContainEqual(
      expect.objectContaining({
        id: 'lead:lead-1',
        kind: 'LEAD',
        phone: '+79991112233',
        unscheduled: true,
      }),
    );
    expect(JSON.stringify(overview)).not.toContain(encryptedPhone);
  });
});
