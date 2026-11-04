import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createRentalSettlementService } from './service';

function fixture(status = 'CONFIRMED') {
  const existing = vi.fn(async () => null);
  const paymentCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'payment-1',
    ...data,
  }));
  const signatureUpsert = vi.fn(async ({ create }: { create: Record<string, unknown> }) => ({
    id: 'signature-1',
    ...create,
  }));
  const tx = {
    rental: {
      findFirst: vi.fn(async ({ where }: { where: { companyId: string; id: string } }) =>
        where.companyId === 'company-1' && where.id === 'rental-1'
          ? {
              id: 'rental-1',
              companyId: 'company-1',
              clientId: 'client-1',
              status,
              contractNumber: '021',
            }
          : null,
      ),
    },
    rentalPayment: { findUnique: existing, create: paymentCreate },
    depositLedgerEntry: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'ledger-1',
        ...data,
      })),
    },
    $queryRaw: vi.fn(async () => [{ locked: true }]),
    rentalSignature: { upsert: signatureUpsert },
    auditLog: { create: vi.fn(async () => ({ id: 'audit-1' })) },
  };
  const database = {
    $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
  };
  return { database, tx, existing, paymentCreate, signatureUpsert };
}

const actor = { id: 'user-1', email: 'operator@example.test' };

describe('rental settlement service', () => {
  it('records a tenant-scoped payment and audit entry', async () => {
    const { database, tx, paymentCreate } = fixture();
    const service = createRentalSettlementService(database as never);

    const result = await service.recordPayment({
      companyId: 'company-1',
      actor,
      command: {
        rentalId: 'rental-1',
        kind: 'RENT',
        status: 'CONFIRMED',
        amountMinor: BigInt(3200000),
        method: 'TRANSFER',
        idempotencyKey: 'payment-rental-1-1',
      },
    });

    expect(result).toMatchObject({ id: 'payment-1', reused: false });
    expect(paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        rentalId: 'rental-1',
        amountMinor: BigInt(3200000),
        recordedByUserId: 'user-1',
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('returns an existing payment for the same idempotency key', async () => {
    const { database, existing, paymentCreate } = fixture();
    existing.mockResolvedValueOnce({ id: 'payment-existing' } as never);
    const service = createRentalSettlementService(database as never);

    const result = await service.recordPayment({
      companyId: 'company-1',
      actor,
      command: {
        rentalId: 'rental-1',
        kind: 'DEPOSIT',
        status: 'CONFIRMED',
        amountMinor: BigInt(1000000),
        method: 'CASH',
        idempotencyKey: 'payment-rental-1-2',
      },
    });

    expect(result).toEqual({ id: 'payment-existing', reused: true });
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it('adds a confirmed deposit payment to the immutable deposit ledger', async () => {
    const { database, tx } = fixture();
    const service = createRentalSettlementService(database as never);

    await service.recordPayment({
      companyId: 'company-1',
      actor,
      command: {
        rentalId: 'rental-1',
        kind: 'DEPOSIT',
        status: 'CONFIRMED',
        amountMinor: 1_000_000n,
        method: 'CASH',
        idempotencyKey: 'payment-rental-1-deposit',
      },
    });

    expect(tx.depositLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        clientId: 'client-1',
        rentalId: 'rental-1',
        paymentId: 'payment-1',
        kind: 'DEPOSIT_PAYMENT',
        source: 'STAFF',
        cashDeltaMinor: 1_000_000n,
        actorUserId: 'user-1',
        reason: 'Внесение залога сотрудником',
      }),
    });
  });

  it('rejects a rental from another tenant', async () => {
    const { database } = fixture();
    const service = createRentalSettlementService(database as never);
    await expect(
      service.recordPayment({
        companyId: 'company-2',
        actor,
        command: {
          rentalId: 'rental-1',
          kind: 'RENT',
          status: 'CONFIRMED',
          amountMinor: BigInt(1),
          method: 'CASH',
          idempotencyKey: 'payment-rental-1-3',
        },
      }),
    ).rejects.toThrow('Договор не найден');
  });

  it('records who signed and when', async () => {
    const { database, signatureUpsert } = fixture();
    const now = new Date('2026-09-05T09:00:00.000Z');
    const service = createRentalSettlementService(database as never, () => now);

    await service.setSignature({
      companyId: 'company-1',
      actor,
      command: {
        rentalId: 'rental-1',
        party: 'CLIENT',
        status: 'SIGNED',
        signedByName: 'Анна Воронова',
      },
    });

    expect(signatureUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ signedAt: now, recordedByUserId: 'user-1' }),
        update: expect.objectContaining({ signedAt: now, recordedByUserId: 'user-1' }),
      }),
    );
  });
});
