import { describe, expect, it, vi } from 'vitest';

import { createRentalReturn } from './return-rental';

describe('createRentalReturn', () => {
  it('calculates return charges, records deposit resolution, and completes atomically', async () => {
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
          billableDays: 3,
          includedMileageKm: 250,
          overageMileagePriceMinor: BigInt(2_000),
          missingFuelPriceMinor: BigInt(5_000),
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
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
          depositStatus: 'PARTIALLY_WITHHELD',
          depositAmountMinor: 600_000,
          depositWithheldMinor: 525_000,
          depositResolutionReason: 'Перепробег и топливо',
        },
      }),
    ).resolves.toEqual({ operationId: 'return-1', rentalId: 'rental-1' });
    expect(transaction.rentalOperation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalChargeMinor: BigInt(525_000),
          depositWithheldMinor: BigInt(525_000),
        }),
      }),
    );
    expect(transaction.rental.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'COMPLETED', completedAt: new Date('2026-08-23T09:00:00Z') },
      }),
    );
  });

  it('commits an actor-owned draft and derives evidence from clean stored media', async () => {
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
        findMany: vi.fn().mockResolvedValue([
          { kind: 'INSPECTION_VIDEO', status: 'CLEAN' },
          { kind: 'DASHBOARD_PHOTO', status: 'CLEAN' },
        ]),
      },
      rental: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'rental-1',
          clientId: 'client-1',
          vehicleId: 'vehicle-1',
          billableDays: 3,
          includedMileageKm: 250,
          overageMileagePriceMinor: BigInt(2_000),
          missingFuelPriceMinor: BigInt(5_000),
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
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
          depositStatus: 'RETURNED',
        },
      }),
    ).resolves.toEqual({ operationId: 'return-draft', rentalId: 'rental-1' });
    expect(transaction.rentalOperation.create).not.toHaveBeenCalled();
    expect(transaction.rentalOperation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMMITTED', evidenceStatus: 'COMPLETE' }),
      }),
    );
  });
});
