import { describe, expect, it, vi } from 'vitest';

import { createOperationDraftPreparer } from './prepare-operation';

function fixture() {
  const transaction = {
    companyMember: { findFirst: vi.fn().mockResolvedValue({ id: 'member-1' }) },
    user: { findFirst: vi.fn().mockResolvedValue(null) },
    rental: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'rental-1',
        clientId: 'client-1',
        vehicleId: 'vehicle-1',
      }),
    },
    rentalOperation: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'operation-1' }),
    },
  };
  return {
    transaction,
    database: { $transaction: vi.fn(async (work) => work(transaction)) },
  };
}

describe('createOperationDraftPreparer', () => {
  it('reauthorizes and binds a draft to the exact confirmed rental, actor, client, and vehicle', async () => {
    const { transaction, database } = fixture();
    const prepare = createOperationDraftPreparer(database as never);

    await expect(
      prepare({
        companyId: 'company-1',
        actor: { id: 'user-1', scope: 'COMPANY' },
        rentalId: 'rental-1',
        type: 'HANDOVER',
        idempotencyKey: 'handover-1',
        occurredAt: new Date('2026-08-21T10:00:00Z'),
      }),
    ).resolves.toEqual({ operationId: 'operation-1' });
    expect(transaction.rental.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rental-1', companyId: 'company-1', status: 'CONFIRMED' },
      }),
    );
    expect(transaction.rentalOperation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'company-1',
          rentalId: 'rental-1',
          clientId: 'client-1',
          vehicleId: 'vehicle-1',
          actorUserId: 'user-1',
          type: 'HANDOVER',
          status: 'DRAFT',
        }),
      }),
    );
  });

  it('returns the actor-owned matching draft on retry', async () => {
    const { transaction, database } = fixture();
    transaction.rentalOperation.findFirst.mockResolvedValue({
      id: 'operation-existing',
      rentalId: 'rental-1',
      actorUserId: 'user-1',
      type: 'HANDOVER',
      status: 'DRAFT',
    });
    const prepare = createOperationDraftPreparer(database as never);

    await expect(
      prepare({
        companyId: 'company-1',
        actor: { id: 'user-1', scope: 'COMPANY' },
        rentalId: 'rental-1',
        type: 'HANDOVER',
        idempotencyKey: 'handover-1',
        occurredAt: new Date('2026-08-21T10:00:00Z'),
      }),
    ).resolves.toEqual({ operationId: 'operation-existing' });
    expect(transaction.rentalOperation.create).not.toHaveBeenCalled();
  });
});
