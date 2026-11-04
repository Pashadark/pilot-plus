import { describe, expect, it, vi } from 'vitest';

import { appendDepositEntry, getRentalDepositBalance } from './ledger';

function database(existing: unknown = null, rows: unknown[] = []) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ locked: true }]),
    depositLedgerEntry: {
      findUnique: vi.fn().mockResolvedValue(existing),
      findMany: vi.fn().mockResolvedValue(rows),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'entry-1', ...data })),
    },
  };
}

const input = {
  companyId: 'company-1',
  clientId: 'client-1',
  rentalId: 'rental-1',
  kind: 'DEPOSIT_PAYMENT' as const,
  source: 'AUTOMATIC' as const,
  cashDeltaMinor: 1_000_000n,
  reservedDeltaMinor: 0n,
  withheldDeltaMinor: 0n,
  debtDeltaMinor: 0n,
  idempotencyKey: 'deposit-payment:payment-1',
  occurredAt: new Date('2026-10-21T08:00:00.000Z'),
};

describe('deposit ledger service', () => {
  it('returns an identical existing entry for the same idempotency key', async () => {
    const existing = { id: 'existing', ...input };
    const db = database(existing);

    await expect(appendDepositEntry(db as never, input)).resolves.toEqual(existing);
    expect(db.depositLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects reuse of an idempotency key with different money deltas', async () => {
    const db = database({ id: 'existing', ...input, cashDeltaMinor: 900_000n });

    await expect(appendDepositEntry(db as never, input)).rejects.toThrow(
      'DEPOSIT_LEDGER_IDEMPOTENCY_CONFLICT',
    );
  });

  it('locks the rental and appends an entry that leaves a valid balance', async () => {
    const db = database(null, []);

    await appendDepositEntry(db as never, input);

    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const lockQuery = db.$queryRaw.mock.calls[0]?.[0] as { strings?: string[] };
    expect(lockQuery.strings?.join('')).toContain(
      'SELECT 1 AS locked FROM pg_advisory_xact_lock',
    );
    expect(db.depositLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining(input),
    });
  });

  it('rejects a reservation larger than available deposit money', async () => {
    const db = database(null, [
      {
        cashDeltaMinor: 100_000n,
        reservedDeltaMinor: 0n,
        withheldDeltaMinor: 0n,
        debtDeltaMinor: 0n,
      },
    ]);

    await expect(
      appendDepositEntry(db as never, {
        ...input,
        kind: 'FINE_RESERVATION',
        cashDeltaMinor: 0n,
        reservedDeltaMinor: 100_001n,
        idempotencyKey: 'fine-reservation:fine-1',
      }),
    ).rejects.toThrow('INVALID_DEPOSIT_LEDGER');
    expect(db.depositLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('projects the current balance for one company rental', async () => {
    const db = database(null, [
      {
        cashDeltaMinor: 1_000_000n,
        reservedDeltaMinor: 250_000n,
        withheldDeltaMinor: 0n,
        debtDeltaMinor: 0n,
      },
    ]);

    await expect(
      getRentalDepositBalance(db as never, 'company-1', 'rental-1'),
    ).resolves.toMatchObject({ availableMinor: 750_000n, reservedMinor: 250_000n });
  });
});
