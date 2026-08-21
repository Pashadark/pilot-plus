import { describe, expect, it, vi } from 'vitest';

import { createRentalHandover } from './handover-rental';

const command = {
  rentalId: 'rental-1',
  idempotencyKey: 'handover-1',
  occurredAt: new Date('2026-08-21T09:00:00Z'),
  mileageKm: 10_000,
  fuelLevelPercent: 80,
  evidenceStatus: 'MISSING' as const,
  evidenceMissingReason: 'Клиент торопился',
  fulfillmentMethod: 'OFFICE' as const,
  fulfillmentAddress: undefined,
  depositStatus: 'COLLECTED' as const,
  depositAmountMinor: 50_000,
  depositPaymentMethod: 'CASH' as const,
};

function database(overrides: Record<string, unknown> = {}) {
  const transaction = {
    companyMember: { findFirst: vi.fn().mockResolvedValue({ id: 'membership-1' }) },
    user: { findFirst: vi.fn().mockResolvedValue({ id: 'actor-1' }) },
    rentalOperation: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'operation-1' }),
    },
    rental: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'rental-1',
        companyId: 'company-1',
        clientId: 'client-1',
        vehicleId: 'vehicle-1',
        status: 'CONFIRMED',
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    ...overrides,
  };
  return {
    transaction,
    database: {
      $transaction: vi.fn(async (work) => work(transaction)),
    },
  };
}

describe('createRentalHandover', () => {
  it('reauthorizes, commits immutable facts, activates the rental, and audits atomically', async () => {
    const fixture = database();
    const handover = createRentalHandover(fixture.database as never);
    await expect(
      handover({
        companyId: 'company-1',
        actor: { id: 'actor-1', scope: 'COMPANY' },
        command,
      }),
    ).resolves.toEqual({ operationId: 'operation-1', rentalId: 'rental-1' });
    expect(fixture.transaction.rental.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rental-1', companyId: 'company-1', status: 'CONFIRMED' },
      }),
    );
    expect(fixture.transaction.rentalOperation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMMITTED', type: 'HANDOVER' }),
      }),
    );
    expect(fixture.transaction.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('returns an already committed idempotent operation without a second transition', async () => {
    const fixture = database({
      rentalOperation: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'operation-existing',
          rentalId: 'rental-1',
          status: 'COMMITTED',
          type: 'HANDOVER',
        }),
        create: vi.fn(),
      },
    });
    const handover = createRentalHandover(fixture.database as never);
    await expect(
      handover({ companyId: 'company-1', actor: { id: 'actor-1', scope: 'COMPANY' }, command }),
    ).resolves.toEqual({ operationId: 'operation-existing', rentalId: 'rental-1' });
    expect(fixture.transaction.rental.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a revoked company membership before loading the rental', async () => {
    const fixture = database({
      companyMember: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    const handover = createRentalHandover(fixture.database as never);
    await expect(
      handover({ companyId: 'company-1', actor: { id: 'actor-1', scope: 'COMPANY' }, command }),
    ).rejects.toThrow('Доступ к операциям аренды запрещён');
    expect(fixture.transaction.rental.findFirst).not.toHaveBeenCalled();
  });
});
