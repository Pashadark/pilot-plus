import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const findIntegration = vi.hoisted(() => vi.fn());
const updateIntegration = vi.hoisted(() => vi.fn());
const findFine = vi.hoisted(() => vi.fn());
const findRentals = vi.hoisted(() => vi.fn());
const upsertFine = vi.hoisted(() => vi.fn());
const createAssignmentHistory = vi.hoisted(() => vi.fn());
const findBoundRental = vi.hoisted(() => vi.fn());
const createRatingEvent = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const runSync = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/services/security/field-encryption', () => ({
  decryptField: vi.fn(() => 'provider-token'),
  blindIndex: vi.fn(),
}));
vi.mock('../integrations/driver-helper/client', () => ({
  DriverHelperClient: class {
    listCars = vi.fn();
    listUnpaidFines = vi.fn();
    listPaidFines = vi.fn();
  },
}));
vi.mock('./sync-company-fines', () => ({ syncCompanyFinesWithDependencies: runSync }));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    fineIntegration: {
      findUnique: findIntegration,
      update: updateIntegration,
    },
    fine: { findUnique: findFine, upsert: upsertFine },
    rental: { findMany: findRentals, findFirst: findBoundRental },
    fineAssignmentHistory: { create: createAssignmentHistory },
    $transaction: transaction,
  },
}));

import { syncCompanyFines } from './sync-company-fines.server';

describe('production company fine sync', () => {
  const now = new Date('2026-08-16T09:30:00.000Z');
  const normalizedFine = {
    externalId: 'fine-1',
    providerVehicleId: 'provider-vehicle-1',
    decreeNumber: '188101',
    decreeAt: null,
    offenseAt: now,
    discountExpiresAt: null,
    originalAmountMinor: BigInt(500000),
    currentAmountMinor: BigInt(250000),
    discountPercent: 50,
    articleCode: null,
    description: null,
    address: null,
    status: 'UNPAID' as const,
    toBailiff: false,
    photoState: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLIENT_DATA_ENCRYPTION_KEY = 'encryption-key';
    process.env.CLIENT_DATA_SEARCH_KEY = 'search-key';
    findIntegration.mockResolvedValue({ tokenEncrypted: 'encrypted', enabled: true });
    updateIntegration.mockResolvedValue({ id: 'integration-1' });
    upsertFine.mockResolvedValue({ id: 'fine-db-1' });
    createAssignmentHistory.mockResolvedValue({ id: 'history-1' });
    transaction.mockImplementation(async (operation: (database: unknown) => Promise<unknown>) =>
      operation({
        fine: { findUnique: findFine, upsert: upsertFine },
        rental: { findMany: findRentals, findFirst: findBoundRental },
        fineAssignmentHistory: { create: createAssignmentHistory },
        clientRatingEvent: { createMany: createRatingEvent },
      }),
    );
    runSync.mockImplementation(
      async (
        companyId: string,
        dependencies: {
          upsertFine(
            tenantId: string,
            fine: typeof normalizedFine,
            vehicleId: string | null,
          ): Promise<{ created: boolean }>;
        },
      ) => {
        await dependencies.upsertFine(companyId, normalizedFine, 'vehicle-1');
        return { ok: true, received: 1, created: 0, updated: 1, unmatched: 0 };
      },
    );
  });

  afterEach(() => {
    delete process.env.CLIENT_DATA_ENCRYPTION_KEY;
    delete process.env.CLIENT_DATA_SEARCH_KEY;
  });

  it('fails closed before network access when the company integration is disabled', async () => {
    findIntegration.mockResolvedValue({ tokenEncrypted: 'encrypted', enabled: false });

    await expect(syncCompanyFines('company-a')).rejects.toThrow(
      'Интеграция Driver Helper не настроена.',
    );
  });

  it('preserves an existing manual assignment during later synchronization', async () => {
    findFine.mockResolvedValue({
      id: 'fine-db-1',
      vehicleId: 'manual-vehicle',
      rentalId: 'manual-rental',
      clientId: 'manual-client',
      assignmentSource: 'MANUAL',
    });
    findRentals.mockResolvedValue([
      {
        id: 'exact-rental',
        clientId: 'exact-client',
        startsAt: new Date('2026-08-16T09:00:00.000Z'),
        endsAt: new Date('2026-08-16T10:00:00.000Z'),
      },
    ]);

    await syncCompanyFines('company-1');

    expect(upsertFine.mock.calls[0]?.[0].update).toMatchObject({
      vehicleId: 'manual-vehicle',
      rentalId: 'manual-rental',
      clientId: 'manual-client',
    });
    expect(createAssignmentHistory).not.toHaveBeenCalled();
  });

  it('records AUTO_EXACT history when synchronization changes an exact assignment', async () => {
    findFine.mockResolvedValue({
      id: 'fine-db-1',
      vehicleId: 'old-vehicle',
      rentalId: 'old-rental',
      clientId: 'old-client',
      assignmentSource: 'AUTO_EXACT',
    });
    findRentals.mockResolvedValue([
      {
        id: 'exact-rental',
        clientId: 'exact-client',
        startsAt: new Date('2026-08-16T09:00:00.000Z'),
        endsAt: new Date('2026-08-16T10:00:00.000Z'),
      },
    ]);

    await syncCompanyFines('company-1');

    expect(transaction).toHaveBeenCalledOnce();
    expect(upsertFine.mock.calls[0]?.[0].update).toMatchObject({
      vehicleId: 'vehicle-1',
      rentalId: 'exact-rental',
      clientId: 'exact-client',
      assignmentSource: 'AUTO_EXACT',
    });
    expect(createAssignmentHistory).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        fineId: 'fine-db-1',
        vehicleId: 'vehicle-1',
        rentalId: 'exact-rental',
        clientId: 'exact-client',
        source: 'AUTO_EXACT',
        actorUserId: null,
      }),
      select: { id: true },
    });
  });

  it('does not replace an existing automatic assignment with an ambiguous result', async () => {
    findFine.mockResolvedValue({
      id: 'fine-db-1',
      vehicleId: 'old-vehicle',
      rentalId: 'old-rental',
      clientId: 'old-client',
      assignmentSource: 'AUTO_EXACT',
    });
    findRentals.mockResolvedValue(
      ['a', 'b'].map((id) => ({
        id: `rental-${id}`,
        clientId: `client-${id}`,
        startsAt: new Date('2026-08-16T09:00:00.000Z'),
        endsAt: new Date('2026-08-16T10:00:00.000Z'),
      })),
    );

    await syncCompanyFines('company-1');

    expect(upsertFine.mock.calls[0]?.[0].update).toMatchObject({
      vehicleId: 'old-vehicle',
      rentalId: 'old-rental',
      clientId: 'old-client',
    });
    expect(createAssignmentHistory).not.toHaveBeenCalled();
  });

  it('does not duplicate AUTO_EXACT history when the exact assignment is unchanged', async () => {
    findFine.mockResolvedValue({
      id: 'fine-db-1',
      vehicleId: 'vehicle-1',
      rentalId: 'exact-rental',
      clientId: 'exact-client',
      assignmentSource: 'AUTO_EXACT',
    });
    findRentals.mockResolvedValue([
      {
        id: 'exact-rental',
        clientId: 'exact-client',
        startsAt: new Date('2026-08-16T09:00:00.000Z'),
        endsAt: new Date('2026-08-16T10:00:00.000Z'),
      },
    ]);

    await syncCompanyFines('company-1');

    expect(upsertFine.mock.calls[0]?.[0].update).toMatchObject({
      rentalId: 'exact-rental',
      clientId: 'exact-client',
      assignmentSource: 'AUTO_EXACT',
    });
    expect(createAssignmentHistory).not.toHaveBeenCalled();
  });

  it('preserves the full manual tuple when the provider vehicle becomes unmatched', async () => {
    findFine.mockResolvedValue({
      id: 'fine-db-1',
      vehicleId: 'manual-vehicle',
      rentalId: 'manual-rental',
      clientId: 'manual-client',
      assignmentSource: 'MANUAL',
    });
    runSync.mockImplementationOnce(
      async (
        companyId: string,
        dependencies: {
          upsertFine(
            tenantId: string,
            fine: typeof normalizedFine,
            vehicleId: string | null,
          ): Promise<{ created: boolean }>;
        },
      ) => {
        await dependencies.upsertFine(companyId, normalizedFine, null);
        return { ok: true, received: 1, created: 0, updated: 1, unmatched: 1 };
      },
    );

    await syncCompanyFines('company-1');

    expect(upsertFine.mock.calls[0]?.[0].update).toMatchObject({
      vehicleId: 'manual-vehicle',
      rentalId: 'manual-rental',
      clientId: 'manual-client',
      assignmentSource: 'MANUAL',
    });
    expect(findRentals).not.toHaveBeenCalled();
    expect(createAssignmentHistory).not.toHaveBeenCalled();
  });

  it('preserves the full AUTO_EXACT tuple when no new exact rental exists', async () => {
    findFine.mockResolvedValue({
      id: 'fine-db-1',
      vehicleId: 'old-vehicle',
      rentalId: 'old-rental',
      clientId: 'old-client',
      assignmentSource: 'AUTO_EXACT',
    });
    findRentals.mockResolvedValue([]);

    await syncCompanyFines('company-1');

    expect(upsertFine.mock.calls[0]?.[0].update).toMatchObject({
      vehicleId: 'old-vehicle',
      rentalId: 'old-rental',
      clientId: 'old-client',
      assignmentSource: 'AUTO_EXACT',
    });
    expect(createAssignmentHistory).not.toHaveBeenCalled();
  });

  it('records one overdue event after a confirmed bound fine transitions from UNPAID', async () => {
    const confirmedUnpaidFine = {
      id: 'fine-db-1',
      vehicleId: 'vehicle-1',
      rentalId: 'rental-1',
      clientId: 'client-1',
      assignmentSource: 'MANUAL',
      assignmentConfirmedAt: new Date('2026-08-16T09:00:00.000Z'),
      assignmentConfirmedByUserId: 'dispatcher-1',
      status: 'UNPAID',
    };
    findFine.mockResolvedValue(confirmedUnpaidFine);
    findRentals.mockResolvedValue([]);
    findBoundRental.mockResolvedValue({ id: 'rental-1' });
    createRatingEvent.mockResolvedValue({ count: 1 });
    runSync.mockImplementation(async (companyId, dependencies) => {
      await dependencies.upsertFine(
        companyId,
        { ...normalizedFine, status: 'UNPAID', toBailiff: true },
        'vehicle-1',
      );
      return { ok: true, received: 1, created: 0, updated: 1, unmatched: 0 };
    });

    await syncCompanyFines('company-1');

    expect(upsertFine.mock.calls[0]?.[0].update).toMatchObject({ status: 'OVERDUE' });
    expect(findBoundRental).toHaveBeenCalledWith({
      where: {
        id: 'rental-1',
        companyId: 'company-1',
        clientId: 'client-1',
        vehicleId: 'vehicle-1',
      },
      select: { id: true },
    });
    expect(createRatingEvent).toHaveBeenCalledWith({
      data: [
        {
          companyId: 'company-1',
          clientId: 'client-1',
          rentalId: 'rental-1',
          fineId: 'fine-db-1',
          source: 'AUTOMATIC',
          actorUserId: null,
          type: 'UNPAID_CONFIRMED_FINE',
          reason: 'UNPAID_CONFIRMED_FINE',
          delta: -15,
          idempotencyKey: 'fine:fine-db-1:confirmed-overdue',
        },
      ],
      skipDuplicates: true,
    });
  });

  it('does not replay an overdue event during repeated synchronization', async () => {
    const confirmedFine = {
      id: 'fine-db-1',
      vehicleId: 'vehicle-1',
      rentalId: 'rental-1',
      clientId: 'client-1',
      assignmentSource: 'MANUAL',
      assignmentConfirmedAt: new Date('2026-08-16T09:00:00.000Z'),
      assignmentConfirmedByUserId: 'dispatcher-1',
    };
    findFine
      .mockResolvedValueOnce({ ...confirmedFine, status: 'UNPAID' })
      .mockResolvedValueOnce({ ...confirmedFine, status: 'OVERDUE' });
    findRentals.mockResolvedValue([]);
    findBoundRental.mockResolvedValue({ id: 'rental-1' });
    createRatingEvent.mockResolvedValue({ count: 1 });
    runSync.mockImplementation(async (companyId, dependencies) => {
      await dependencies.upsertFine(
        companyId,
        { ...normalizedFine, status: 'UNPAID', toBailiff: true },
        'vehicle-1',
      );
      return { ok: true, received: 1, created: 0, updated: 1, unmatched: 0 };
    });

    await syncCompanyFines('company-1');
    await syncCompanyFines('company-1');

    expect(createRatingEvent).toHaveBeenCalledTimes(1);
  });

  it('does not score an unconfirmed exact attribution when it becomes overdue', async () => {
    findFine.mockResolvedValue({
      id: 'fine-db-1',
      vehicleId: 'vehicle-1',
      rentalId: 'rental-1',
      clientId: 'client-1',
      assignmentSource: 'AUTO_EXACT',
      assignmentConfirmedAt: null,
      assignmentConfirmedByUserId: null,
      status: 'UNPAID',
    });
    findRentals.mockResolvedValue([]);
    runSync.mockImplementation(async (companyId, dependencies) => {
      await dependencies.upsertFine(
        companyId,
        { ...normalizedFine, status: 'UNPAID', toBailiff: true },
        'vehicle-1',
      );
      return { ok: true, received: 1, created: 0, updated: 1, unmatched: 0 };
    });

    await syncCompanyFines('company-1');

    expect(findBoundRental).not.toHaveBeenCalled();
    expect(createRatingEvent).not.toHaveBeenCalled();
  });

  it('fails the entire sync transaction when the overdue ledger write fails', async () => {
    findFine.mockResolvedValue({
      id: 'fine-db-1',
      vehicleId: 'vehicle-1',
      rentalId: 'rental-1',
      clientId: 'client-1',
      assignmentSource: 'MANUAL',
      assignmentConfirmedAt: new Date('2026-08-16T09:00:00.000Z'),
      assignmentConfirmedByUserId: 'dispatcher-1',
      status: 'UNPAID',
    });
    findRentals.mockResolvedValue([]);
    findBoundRental.mockResolvedValue({ id: 'rental-1' });
    createRatingEvent.mockRejectedValue(new Error('ledger unavailable'));
    runSync.mockImplementation(async (companyId, dependencies) => {
      await dependencies.upsertFine(
        companyId,
        { ...normalizedFine, status: 'UNPAID', toBailiff: true },
        'vehicle-1',
      );
      return { ok: true, received: 1, created: 0, updated: 1, unmatched: 0 };
    });

    await expect(syncCompanyFines('company-1')).rejects.toThrow('ledger unavailable');

    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(updateIntegration).toHaveBeenLastCalledWith({
      where: { companyId: 'company-1' },
      data: { lastErrorCode: 'UNAVAILABLE' },
      select: { id: true },
    });
  });
});
