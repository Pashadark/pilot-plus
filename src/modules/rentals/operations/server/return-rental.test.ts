import { describe, expect, it, vi } from 'vitest';

import { createRentalReturn, resolveReturnPricing } from './return-rental';

describe('createRentalReturn', () => {
  it('uses vehicle defaults when a legacy rental has no mileage terms', () => {
    expect(
      resolveReturnPricing({
        includedMileageKm: null,
        overageMileagePriceMinor: null,
        missingFuelPriceMinor: BigInt(15_000),
        vehicle: {
          includedMileageKm: 200,
          overageMileagePriceMinor: BigInt(1_000),
          missingFuelPriceMinor: BigInt(15_000),
        },
      }),
    ).toEqual({
      includedMileageKmPerDay: 200,
      overageMileagePriceMinor: 1_000,
      missingFuelPriceMinor: 15_000,
    });
  });

  it('uses 200 km per day when a standard legacy rental and vehicle have no mileage limit', () => {
    expect(
      resolveReturnPricing({
        agreementType: 'STANDARD',
        includedMileageKm: null,
        overageMileagePriceMinor: BigInt(1_000),
        missingFuelPriceMinor: BigInt(15_000),
        vehicle: {
          includedMileageKm: null,
          overageMileagePriceMinor: BigInt(1_000),
          missingFuelPriceMinor: BigInt(15_000),
        },
      }),
    ).toEqual(
      expect.objectContaining({
        includedMileageKmPerDay: 200,
      }),
    );
  });

  it('disables mileage charges for a lease-to-own rental', () => {
    expect(
      resolveReturnPricing({
        agreementType: 'LEASE_TO_OWN',
        includedMileageKm: null,
        overageMileagePriceMinor: BigInt(1_000),
        missingFuelPriceMinor: BigInt(15_000),
        vehicle: {
          includedMileageKm: 200,
          overageMileagePriceMinor: BigInt(1_000),
          missingFuelPriceMinor: BigInt(15_000),
        },
      }),
    ).toEqual(
      expect.objectContaining({
        includedMileageKmPerDay: 0,
        overageMileagePriceMinor: 0,
      }),
    );
  });

  it('calculates return charges, leaves the deposit unresolved, and completes atomically', async () => {
    const transaction = {
      companyMember: { findFirst: vi.fn().mockResolvedValue({ id: 'member-1' }) },
      user: { findFirst: vi.fn() },
      rentalOperation: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ mileageKm: 10_000, fuelLevelPercent: 80 }),
        create: vi.fn().mockResolvedValue({ id: 'return-1' }),
      },
      rental: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'rental-1',
          clientId: 'client-1',
          vehicleId: 'vehicle-1',
          endsAt: new Date('2026-08-23T10:00:00Z'),
          billableDays: 3,
          includedMileageKm: 250,
          overageMileagePriceMinor: BigInt(2_000),
          missingFuelPriceMinor: BigInt(5_000),
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      maintenanceRecord: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'maintenance-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      clientComment: { findFirst: vi.fn().mockResolvedValue(null) },
      clientRatingEvent: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      telegramGroupBinding: {
        findUnique: vi.fn().mockResolvedValue({
          telegramChatId: '-100777',
          boundByUserId: 'actor-1',
        }),
      },
      telegramIdentity: { findFirst: vi.fn().mockResolvedValue({ id: 'identity-1' }) },
      botNotificationJob: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const complete = createRentalReturn({
      $transaction: vi.fn(async (work) => work(transaction)),
    } as never);
    await expect(
      complete({
        companyId: 'company-1',
        actor: { id: 'actor-1', scope: 'COMPANY' },
        command: {
          rentalId: 'rental-1',
          idempotencyKey: 'return-key',
          occurredAt: new Date('2026-08-23T09:00:00Z'),
          mileageKm: 10_950,
          fuelLevelPercent: 55,
          evidenceStatus: 'COMPLETE',
          vehicleCondition: 'GOOD',
        },
      }),
    ).resolves.toEqual({ operationId: 'return-1', rentalId: 'rental-1' });
    expect(transaction.rentalOperation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalChargeMinor: BigInt(825_000),
          depositStatus: null,
          depositAmountMinor: null,
          depositWithheldMinor: null,
          depositResolutionReason: null,
        }),
      }),
    );
    expect(transaction.rental.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'COMPLETED', completedAt: new Date('2026-08-23T09:00:00Z') },
      }),
    );
    expect(transaction.vehicle.updateMany).toHaveBeenCalledWith({
      where: { id: 'vehicle-1', companyId: 'company-1' },
      data: { odometerKm: 10_950 },
    });
    expect(transaction.maintenanceRecord.create).toHaveBeenCalledWith({
      data: {
        vehicleId: 'vehicle-1',
        title: 'Плановое ТО через 7 000 км',
        kind: 'INSPECTION',
        status: 'PLANNED',
        odometerKm: 10_950,
        targetOdometerKm: 17_950,
      },
      select: { id: true },
    });
    expect(transaction.botNotificationJob.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          chatId: '-100777',
          eventKey: 'rental-lifecycle:return-1:group:-100777',
          template: 'RENTAL_LIFECYCLE',
          payload: {
            kind: 'RETURN',
            rentalId: 'rental-1',
            operationId: 'return-1',
          },
        }),
        expect.objectContaining({
          identityId: 'identity-1',
          eventKey: 'rental-lifecycle:return-1:client:identity-1',
          template: 'CLIENT_RENTAL_LIFECYCLE',
        }),
      ]),
      skipDuplicates: true,
    });
  });

  it('closes an old rental without handover readings and applies no automatic charges', async () => {
    const transaction = {
      companyMember: { findFirst: vi.fn().mockResolvedValue({ id: 'member-1' }) },
      user: { findFirst: vi.fn() },
      rentalOperation: {
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValue({ id: 'return-legacy' }),
      },
      rental: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'rental-legacy',
          clientId: 'client-1',
          vehicleId: 'vehicle-1',
          endsAt: new Date('2026-08-20T10:00:00Z'),
          billableDays: 3,
          includedMileageKm: 250,
          overageMileagePriceMinor: BigInt(2_000),
          missingFuelPriceMinor: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      clientComment: { findFirst: vi.fn().mockResolvedValue(null) },
      clientRatingEvent: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const complete = createRentalReturn({
      $transaction: vi.fn(async (work) => work(transaction)),
    } as never);

    await expect(
      complete({
        companyId: 'company-1',
        actor: { id: 'actor-1', scope: 'COMPANY' },
        command: {
          rentalId: 'rental-legacy',
          idempotencyKey: 'return-legacy-key',
          occurredAt: new Date('2026-09-06T09:00:00Z'),
          mileageKm: 125_000,
          fuelLevelPercent: 40,
          evidenceStatus: 'MISSING',
          evidenceMissingReason: 'Фиксация не приложена.',
          vehicleCondition: 'GOOD',
        },
      }),
    ).resolves.toEqual({ operationId: 'return-legacy', rentalId: 'rental-legacy' });
    expect(transaction.rentalOperation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mileageChargeMinor: BigInt(0),
          fuelChargeMinor: BigInt(0),
          totalChargeMinor: BigInt(0),
        }),
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changes: expect.objectContaining({ handoverReadingsMissing: true }),
        }),
      }),
    );
  });

  it('commits an actor-owned draft with a clean photo and no video', async () => {
    const transaction = {
      companyMember: { findFirst: vi.fn().mockResolvedValue({ id: 'member-1' }) },
      user: { findFirst: vi.fn() },
      rentalOperation: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'return-draft',
            rentalId: 'rental-1',
            actorUserId: 'actor-1',
            status: 'DRAFT',
            type: 'RETURN',
          })
          .mockResolvedValueOnce({ mileageKm: 10_000, fuelLevelPercent: 80 }),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      rentalOperationMedia: {
        findMany: vi.fn().mockResolvedValue([{ kind: 'DASHBOARD_PHOTO', status: 'CLEAN' }]),
      },
      rental: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'rental-1',
          clientId: 'client-1',
          vehicleId: 'vehicle-1',
          endsAt: new Date('2026-08-23T10:00:00Z'),
          billableDays: 3,
          includedMileageKm: 250,
          overageMileagePriceMinor: BigInt(2_000),
          missingFuelPriceMinor: BigInt(5_000),
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      clientComment: { findFirst: vi.fn().mockResolvedValue(null) },
      clientRatingEvent: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const complete = createRentalReturn({
      $transaction: vi.fn(async (work) => work(transaction)),
    } as never);

    await expect(
      complete({
        companyId: 'company-1',
        actor: { id: 'actor-1', scope: 'COMPANY' },
        command: {
          rentalId: 'rental-1',
          idempotencyKey: 'return-key',
          occurredAt: new Date('2026-08-23T09:00:00Z'),
          mileageKm: 10_950,
          fuelLevelPercent: 55,
          evidenceStatus: 'MISSING',
          vehicleCondition: 'GOOD',
        },
      }),
    ).resolves.toEqual({ operationId: 'return-draft', rentalId: 'rental-1' });
    expect(transaction.rentalOperation.create).not.toHaveBeenCalled();
    expect(transaction.rentalOperation.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        select: expect.objectContaining({ actorUserId: true }),
      }),
    );
    expect(transaction.rentalOperation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMMITTED',
          evidenceStatus: 'COMPLETE',
          evidenceMissingReason: null,
        }),
      }),
    );
  });

  it('records clean and on-time rating events only after committing the return', async () => {
    const transaction = {
      companyMember: { findFirst: vi.fn().mockResolvedValue({ id: 'member-1' }) },
      user: { findFirst: vi.fn() },
      rentalOperation: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ mileageKm: 10_000, fuelLevelPercent: 80 }),
        create: vi.fn().mockResolvedValue({ id: 'return-1' }),
      },
      rental: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'rental-1',
          clientId: 'client-1',
          vehicleId: 'vehicle-1',
          endsAt: new Date('2026-08-23T10:00:00Z'),
          billableDays: 1,
          includedMileageKm: 250,
          overageMileagePriceMinor: BigInt(2_000),
          missingFuelPriceMinor: BigInt(5_000),
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      clientComment: { findFirst: vi.fn().mockResolvedValue(null) },
      clientRatingEvent: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const complete = createRentalReturn({
      $transaction: vi.fn(async (work) => work(transaction)),
    } as never);

    await complete({
      companyId: 'company-1',
      actor: { id: 'actor-1', scope: 'COMPANY' },
      command: {
        rentalId: 'rental-1',
        idempotencyKey: 'return-key',
        occurredAt: new Date('2026-08-23T09:00:00Z'),
        mileageKm: 10_100,
        fuelLevelPercent: 80,
        evidenceStatus: 'COMPLETE',
        vehicleCondition: 'GOOD',
      },
    });

    expect(transaction.clientRatingEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: 'CLEAN_RENTAL',
          reason: 'CLEAN_RENTAL_COMPLETED',
          delta: 8,
          idempotencyKey: 'rental:rental-1:clean-completion',
        }),
      ],
      skipDuplicates: true,
    });
    expect(transaction.clientRatingEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: 'ON_TIME_RETURN',
          reason: 'ON_TIME_RETURN_COMPLETED',
          delta: 2,
          idempotencyKey: 'rental:rental-1:on-time-return',
        }),
      ],
      skipDuplicates: true,
    });
    expect(transaction.rentalOperation.create.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.clientRatingEvent.createMany.mock.invocationCallOrder[0],
    );
  });

  it('does not reward a clean completion while that rental has an open problem', async () => {
    const transaction = {
      companyMember: { findFirst: vi.fn().mockResolvedValue({ id: 'member-1' }) },
      user: { findFirst: vi.fn() },
      rentalOperation: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ mileageKm: 10_000, fuelLevelPercent: 80 }),
        create: vi.fn().mockResolvedValue({ id: 'return-1' }),
      },
      rental: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'rental-1',
          clientId: 'client-1',
          vehicleId: 'vehicle-1',
          endsAt: new Date('2026-08-23T10:00:00Z'),
          billableDays: 1,
          includedMileageKm: 250,
          overageMileagePriceMinor: BigInt(2_000),
          missingFuelPriceMinor: BigInt(5_000),
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      clientComment: { findFirst: vi.fn().mockResolvedValue({ id: 'open-comment-1' }) },
      clientRatingEvent: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const complete = createRentalReturn({
      $transaction: vi.fn(async (work) => work(transaction)),
    } as never);

    await complete({
      companyId: 'company-1',
      actor: { id: 'actor-1', scope: 'COMPANY' },
      command: {
        rentalId: 'rental-1',
        idempotencyKey: 'return-key',
        occurredAt: new Date('2026-08-23T09:00:00Z'),
        mileageKm: 10_100,
        fuelLevelPercent: 80,
        evidenceStatus: 'COMPLETE',
        vehicleCondition: 'GOOD',
      },
    });

    expect(transaction.clientComment.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        rentalId: 'rental-1',
        hiddenAt: null,
        problemStatus: 'OPEN',
      },
      select: { id: true },
    });
    expect(transaction.clientRatingEvent.createMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ type: 'CLEAN_RENTAL' })],
      }),
    );
  });
});
