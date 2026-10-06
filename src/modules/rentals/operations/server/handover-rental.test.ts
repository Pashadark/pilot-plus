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
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    rentalOperationMedia: { findMany: vi.fn().mockResolvedValue([]) },
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
    vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    telegramGroupBinding: {
      findUnique: vi.fn().mockResolvedValue({
        telegramChatId: '-100777',
        boundByUserId: 'actor-1',
      }),
    },
    telegramIdentity: { findFirst: vi.fn().mockResolvedValue({ id: 'identity-1' }) },
    botNotificationJob: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
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
    expect(fixture.transaction.vehicle.updateMany).toHaveBeenCalledWith({
      where: { id: 'vehicle-1', companyId: 'company-1' },
      data: { odometerKm: 10_000 },
    });
    expect(fixture.transaction.auditLog.create).toHaveBeenCalledTimes(1);
    expect(fixture.transaction.botNotificationJob.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          chatId: '-100777',
          eventKey: 'rental-lifecycle:operation-1:group:-100777',
          template: 'RENTAL_LIFECYCLE',
          payload: {
            kind: 'HANDOVER',
            rentalId: 'rental-1',
            operationId: 'operation-1',
          },
        }),
        expect.objectContaining({
          identityId: 'identity-1',
          eventKey: 'rental-lifecycle:operation-1:client:identity-1',
          template: 'CLIENT_RENTAL_LIFECYCLE',
        }),
      ]),
      skipDuplicates: true,
    });
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

  it('commits an actor-owned draft and derives complete evidence only from clean stored media', async () => {
    const fixture = database({
      rentalOperation: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'operation-draft',
          rentalId: 'rental-1',
          status: 'DRAFT',
          type: 'HANDOVER',
          actorUserId: 'actor-1',
        }),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      rentalOperationMedia: {
        findMany: vi.fn().mockResolvedValue([
          { kind: 'INSPECTION_VIDEO', status: 'CLEAN' },
          { kind: 'DASHBOARD_PHOTO', status: 'CLEAN' },
        ]),
      },
    });
    const handover = createRentalHandover(fixture.database as never);

    await expect(
      handover({
        companyId: 'company-1',
        actor: { id: 'actor-1', scope: 'COMPANY' },
        command: { ...command, evidenceStatus: 'MISSING', evidenceMissingReason: undefined },
      }),
    ).resolves.toEqual({ operationId: 'operation-draft', rentalId: 'rental-1' });
    expect(fixture.transaction.rentalOperation.create).not.toHaveBeenCalled();
    expect(fixture.transaction.rentalOperation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'operation-draft', status: 'DRAFT' }),
        data: expect.objectContaining({
          status: 'COMMITTED',
          evidenceStatus: 'COMPLETE',
          evidenceMissingReason: null,
        }),
      }),
    );
  });

  it('blocks a new handover when the committed PDF is missing', async () => {
    const fixture = database({
      rental: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'rental-1',
          companyId: 'company-1',
          clientId: 'client-1',
          vehicleId: 'vehicle-1',
          status: 'CONFIRMED',
          totalPriceMinor: BigInt(100_000),
          depositMinor: BigInt(50_000),
          documentVersions: [],
          signatures: [
            { party: 'CLIENT', status: 'SIGNED' },
            { party: 'COMPANY', status: 'SIGNED' },
          ],
          payments: [
            { kind: 'RENT', status: 'CONFIRMED', amountMinor: BigInt(100_000) },
            { kind: 'DEPOSIT', status: 'CONFIRMED', amountMinor: BigInt(50_000) },
          ],
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    });
    const handover = createRentalHandover(fixture.database as never);

    await expect(
      handover({
        companyId: 'company-1',
        actor: { id: 'actor-1', scope: 'COMPANY' },
        command: { ...command, occurredAt: new Date('2026-09-03T09:00:00.000Z') },
      }),
    ).rejects.toThrow('Перед выдачей сформируйте PDF договора.');
    expect(fixture.transaction.rental.updateMany).not.toHaveBeenCalled();
  });
});
