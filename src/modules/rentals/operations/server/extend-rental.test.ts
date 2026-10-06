import { describe, expect, it, vi } from 'vitest';

import { createRentalExtension } from './extend-rental';

describe('createRentalExtension', () => {
  it('rejects conflicts and otherwise stores before/after dates and surcharge atomically', async () => {
    const transaction = {
      companyMember: { findFirst: vi.fn().mockResolvedValue({ id: 'member-1' }) },
      user: { findFirst: vi.fn() },
      rentalOperation: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'extension-1' }),
      },
      rental: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'rental-1',
          clientId: 'client-1',
          vehicleId: 'vehicle-1',
          startsAt: new Date('2026-08-20T09:00:00Z'),
          endsAt: new Date('2026-08-21T09:00:00Z'),
          dailyRateMinor: BigInt(470_000),
          totalPriceMinor: BigInt(470_000),
          billableDays: 1,
        }),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      maintenanceRecord: { findFirst: vi.fn().mockResolvedValue(null) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      telegramGroupBinding: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ telegramChatId: 'group-1', boundByUserId: 'actor-1' }),
      },
      telegramIdentity: { findFirst: vi.fn().mockResolvedValue({ id: 'staff-1' }) },
      botNotificationJob: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    const extend = createRentalExtension({
      $transaction: vi.fn(async (work) => work(transaction)),
    } as never);
    await expect(
      extend({
        companyId: 'company-1',
        actor: { id: 'actor-1', scope: 'COMPANY' },
        command: {
          rentalId: 'rental-1',
          idempotencyKey: 'extension-key',
          occurredAt: new Date('2026-08-21T08:00:00Z'),
          nextEndsAt: new Date('2026-08-23T09:00:00Z'),
        },
      }),
    ).resolves.toEqual({ operationId: 'extension-1', rentalId: 'rental-1' });
    expect(transaction.botNotificationJob.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          template: 'RENTAL_LIFECYCLE',
          chatId: 'group-1',
          payload: { kind: 'EXTENSION', rentalId: 'rental-1', operationId: 'extension-1' },
        }),
      ]),
      skipDuplicates: true,
    });
    transaction.rentalOperation.findFirst.mockResolvedValue({
      id: 'extension-1',
      rentalId: 'rental-1',
      type: 'EXTENSION',
      status: 'COMMITTED',
    });
    await extend({
      companyId: 'company-1',
      actor: { id: 'actor-1', scope: 'COMPANY' },
      command: {
        rentalId: 'rental-1',
        idempotencyKey: 'extension-key',
        occurredAt: new Date('2026-08-21T08:00:00Z'),
        nextEndsAt: new Date('2026-08-23T09:00:00Z'),
      },
    });
    expect(transaction.botNotificationJob.createMany).toHaveBeenCalledTimes(1);
    expect(transaction.rental.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          endsAt: new Date('2026-08-23T09:00:00Z'),
          totalPriceMinor: BigInt(1_410_000),
          billableDays: 3,
        }),
      }),
    );
    expect(transaction.rentalOperation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ extensionChargeMinor: BigInt(940_000) }),
      }),
    );
  });

  it('blocks an overlapping rental before changing dates', async () => {
    const transaction = {
      companyMember: { findFirst: vi.fn().mockResolvedValue({ id: 'member-1' }) },
      user: { findFirst: vi.fn() },
      rentalOperation: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
      rental: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'rental-1',
          clientId: 'client-1',
          vehicleId: 'vehicle-1',
          startsAt: new Date('2026-08-20T09:00:00Z'),
          endsAt: new Date('2026-08-21T09:00:00Z'),
          dailyRateMinor: BigInt(470_000),
          totalPriceMinor: BigInt(470_000),
          billableDays: 1,
        }),
        findMany: vi.fn().mockResolvedValue([{ id: 'other-rental' }]),
        updateMany: vi.fn(),
      },
      maintenanceRecord: { findFirst: vi.fn().mockResolvedValue(null) },
      auditLog: { create: vi.fn() },
    };
    const extend = createRentalExtension({
      $transaction: vi.fn(async (work) => work(transaction)),
    } as never);
    await expect(
      extend({
        companyId: 'company-1',
        actor: { id: 'actor-1', scope: 'COMPANY' },
        command: {
          rentalId: 'rental-1',
          idempotencyKey: 'key',
          occurredAt: new Date(),
          nextEndsAt: new Date('2026-08-23T09:00:00Z'),
        },
      }),
    ).rejects.toThrow('занят');
    expect(transaction.rental.updateMany).not.toHaveBeenCalled();
  });
});
