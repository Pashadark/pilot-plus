import { describe, expect, it, vi } from 'vitest';

import { encryptField } from '@/services/security/field-encryption';

import { createDashboardQueries } from './queries';

vi.mock('@/database/prisma/client', () => ({
  prisma: {
    companyMember: { findFirst: vi.fn() },
    vehicle: { findMany: vi.fn() },
    rental: { findMany: vi.fn() },
    client: { count: vi.fn() },
    maintenanceRecord: { findMany: vi.fn() },
    washRecord: { findMany: vi.fn() },
    operationsTask: { findMany: vi.fn() },
    lead: { findMany: vi.fn() },
    fine: { findMany: vi.fn() },
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
        positions: [{ id: 'position-1', recordedAt: NOW, fuelLevelPercent: null }],
        rentalOperations: [],
      },
    ]),
    rentalFindMany: vi.fn().mockResolvedValue([]),
    clientCount: vi.fn().mockResolvedValue(0),
    maintenanceFindMany: vi.fn().mockResolvedValue([]),
    washFindMany: vi.fn().mockResolvedValue([]),
    taskFindMany: vi.fn().mockResolvedValue([]),
    leadFindMany: vi.fn().mockResolvedValue([]),
    fineFindMany: vi.fn().mockResolvedValue([]),
  };
}

describe('dashboard server queries', () => {
  it('loads a day with one tenant-scoped rental query and no finance/weather queries', async () => {
    const repository = repositoryFixture();
    const queries = createDashboardQueries(
      repository,
      async () => ({ companyId: 'company-1', canViewClientPhone: false }),
      { encryptionKey: ENCRYPTION_KEY },
    );
    expect(await queries.getDayEvents('2026-10-09', NOW)).toEqual([]);
    expect(repository.rentalFindMany).toHaveBeenCalledTimes(1);
    expect(repository.rentalFindMany.mock.calls[0][0].where.companyId).toBe('company-1');
    expect(repository.vehicleFindMany).not.toHaveBeenCalled();
    expect(repository.clientCount).not.toHaveBeenCalled();
    await expect(queries.getDayEvents('2026-02-31', NOW)).rejects.toThrow();
  });
  it('loads completed deposits when a selected day can contain their return reminder', async () => {
    const repository = repositoryFixture();
    const queries = createDashboardQueries(
      repository,
      async () => ({ companyId: 'company-1', canViewClientPhone: false }),
      { encryptionKey: ENCRYPTION_KEY },
    );

    await queries.getDayEvents('2026-10-09', NOW);

    expect(repository.rentalFindMany.mock.calls[0]?.[0]?.where).toMatchObject({
      companyId: 'company-1',
      vehicle: { archivedAt: null, isDemoImport: false },
      OR: expect.arrayContaining([
        {
          status: 'COMPLETED',
          depositMinor: { gt: 0 },
        },
      ]),
    });
  });
  it('keeps an overdue active rental visible on the current day until its return is completed', async () => {
    const repository = repositoryFixture();
    repository.rentalFindMany.mockResolvedValueOnce([
      {
        id: 'rental-overdue',
        clientId: 'client-1',
        vehicleId: 'vehicle-1',
        status: 'ACTIVE',
        startsAt: new Date('2026-08-20T09:00:00.000Z'),
        endsAt: new Date('2026-08-23T09:00:00.000Z'),
        completedAt: null,
        totalPriceMinor: 600000n,
        depositMinor: 1000000n,
        contractNumber: 'ME-2026-0093-BI',
        client: { firstName: 'Иван', middleName: 'Дмитриевич', lastName: 'Божко' },
        vehicle: { make: 'Kia', model: 'Ceed', registrationNumber: 'А429АУ997' },
        payments: [],
        operations: [],
      },
    ]);

    const items = await createDashboardQueries(
      repository,
      async () => ({ companyId: 'company-1', canViewClientPhone: false }),
      { encryptionKey: ENCRYPTION_KEY },
    ).getDayEvents('2026-08-24', NOW);

    expect(items).toEqual([
      expect.objectContaining({
        id: 'rental-return:rental-overdue',
        kind: 'RETURN',
        overdue: true,
        clientLabel: 'Божко Иван Дмитриевич',
      }),
    ]);
    expect(repository.rentalFindMany.mock.calls[0]?.[0]?.where.OR).toContainEqual({
      status: 'ACTIVE',
      startsAt: { lt: new Date('2026-08-24T21:00:00.000Z') },
    });
  });
  it('loads tomorrow and later tasks for today without widening the KPI period', async () => {
    const repository = repositoryFixture();
    const overview = await createDashboardQueries(
      repository,
      async () => ({ companyId: 'company-1', canViewClientPhone: false }),
      { encryptionKey: ENCRYPTION_KEY },
    ).getOverview('today', NOW);
    const args = repository.taskFindMany.mock.calls[0]?.[0];
    expect(args.where.dueAt.lt.getTime()).toBeGreaterThan(
      new Date('2026-08-25T21:00:00Z').getTime(),
    );
    expect(overview.period.toExclusive).toBe('2026-08-24T21:00:00.000Z');
  });
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
      repository.clientCount,
      repository.maintenanceFindMany,
      repository.washFindMany,
      repository.taskFindMany,
      repository.leadFindMany,
      repository.fineFindMany,
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
    expect(repository.clientCount).toHaveBeenCalledWith({
      where: { companyId: 'company-1', archivedAt: null },
    });
    expect(repository.maintenanceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: ['PLANNED', 'IN_PROGRESS', 'OVERDUE', 'DAMAGE_REPORTED', 'WAITING_REPAIR'],
          },
          OR: expect.arrayContaining([
            expect.objectContaining({
              scheduledAt: { lt: new Date('2026-09-22T21:00:00.000Z') },
            }),
            expect.objectContaining({
              recordType: 'REPAIR',
              damageReportedAt: { lt: new Date('2026-09-22T21:00:00.000Z') },
            }),
          ]),
        }),
        select: expect.objectContaining({ recordType: true, damageReportedAt: true }),
      }),
    );
    expect(repository.washFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
          scheduledAt: { lt: new Date('2026-09-22T21:00:00.000Z') },
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
    expect(repository.clientCount).not.toHaveBeenCalled();
    expect(repository.maintenanceFindMany).not.toHaveBeenCalled();
    expect(repository.washFindMany).not.toHaveBeenCalled();
    expect(repository.taskFindMany).not.toHaveBeenCalled();
    expect(repository.leadFindMany).not.toHaveBeenCalled();
    expect(repository.fineFindMany).not.toHaveBeenCalled();
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
          startsAt: { lt: new Date('2026-09-22T21:00:00.000Z') },
        },
      ]),
    });
  });

  it('loads completed rentals and confirmed deposit payments for advance return reminders', async () => {
    const repository = repositoryFixture();

    await createDashboardQueries(
      repository,
      async () => ({ companyId: 'company-1', canViewClientPhone: false }),
      { encryptionKey: ENCRYPTION_KEY },
    ).getOverview('today', NOW);

    const rentalQuery = repository.rentalFindMany.mock.calls[0]?.[0];

    expect(rentalQuery?.where).toMatchObject({
      companyId: 'company-1',
      OR: expect.arrayContaining([
        {
          status: 'COMPLETED',
          depositMinor: { gt: 0 },
        },
      ]),
    });
    expect(rentalQuery?.where.OR[1]).not.toHaveProperty('operations');
    expect(rentalQuery?.select.payments).toEqual({
      where: { kind: 'DEPOSIT', status: 'CONFIRMED' },
      select: { kind: true, status: true, amountMinor: true },
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

  it('loads unresolved new fines with their vehicle, client and rental context', async () => {
    const repository = repositoryFixture();

    await createDashboardQueries(
      repository,
      async () => ({ companyId: 'company-1', canViewClientPhone: false }),
      { encryptionKey: ENCRYPTION_KEY },
    ).getOverview('today', NOW);

    expect(repository.fineFindMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        status: { in: ['NEW', 'UNPAID', 'OVERDUE'] },
      },
      select: expect.objectContaining({
        id: true,
        decreeNumber: true,
        createdAt: true,
        currentAmountMinor: true,
        status: true,
        discountExpiresAt: true,
        vehicle: expect.any(Object),
        client: expect.any(Object),
        rental: expect.any(Object),
      }),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  });

  it('loads current fuel and falls back to the latest committed rental reading', async () => {
    const repository = repositoryFixture();
    repository.vehicleFindMany.mockResolvedValue([
      {
        id: 'vehicle-1',
        make: 'Kia',
        model: 'Rio',
        registrationNumber: 'A001AA777',
        archivedAt: null,
        isDemoImport: false,
        positions: [{ id: 'position-1', recordedAt: NOW, fuelLevelPercent: null }],
        rentalOperations: [
          {
            id: 'operation-1',
            occurredAt: new Date('2026-08-24T08:50:00.000Z'),
            fuelLevelPercent: 18,
          },
        ],
      },
    ]);

    const overview = await createDashboardQueries(
      repository,
      async () => ({ companyId: 'company-1', canViewClientPhone: false }),
      { encryptionKey: ENCRYPTION_KEY },
    ).getOverview('today', NOW);

    expect(repository.vehicleFindMany.mock.calls[0]?.[0]).toHaveProperty(
      'select.positions.select.fuelLevelPercent',
      true,
    );
    expect(repository.vehicleFindMany.mock.calls[1]?.[0]).toHaveProperty(
      'select.positions.where.fuelLevelPercent',
      { not: null },
    );
    expect(repository.vehicleFindMany.mock.calls[0]?.[0]).toHaveProperty(
      'select.rentalOperations.select.fuelLevelPercent',
      true,
    );
    expect(overview.workItems).toContainEqual(
      expect.objectContaining({ kind: 'LOW_FUEL', clientLabel: 'Остаток топлива: 18%' }),
    );
  });
});
