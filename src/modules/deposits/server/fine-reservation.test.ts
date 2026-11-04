import { describe, expect, it, vi } from 'vitest';

import {
  calculateFineCharge,
  reconcileFineDepositReservation,
  reserveFineFromDeposit,
} from './fine-reservation';

function database(balanceRows: unknown[]) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ locked: true }]),
    depositLedgerEntry: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue(balanceRows),
      create: vi.fn(async ({ data }) => ({ id: 'entry-1', ...data })),
    },
  };
}

function databaseWithFineEntries(balanceRows: unknown[], fineRows: unknown[]) {
  const db = database(balanceRows);
  db.depositLedgerEntry.findMany = vi
    .fn()
    .mockResolvedValueOnce(fineRows)
    .mockResolvedValue(balanceRows);
  return db;
}

const deposit = (cashDeltaMinor: bigint) => ({
  cashDeltaMinor,
  reservedDeltaMinor: 0n,
  withheldDeltaMinor: 0n,
  debtDeltaMinor: 0n,
});

describe('fine deposit reservation', () => {
  it('calculates a 15% commission in integer kopecks', () => {
    expect(calculateFineCharge(375_000n)).toEqual({
      fineAmountMinor: 375_000n,
      commissionAmountMinor: 56_250n,
      totalAmountMinor: 431_250n,
      commissionBasisPoints: 1500,
    });
  });

  it('rounds a fractional kopeck commission up', () => {
    expect(calculateFineCharge(1n).commissionAmountMinor).toBe(1n);
  });

  it('reserves the complete charge when the deposit is sufficient', async () => {
    const db = database([deposit(1_000_000n)]);

    await reserveFineFromDeposit(db as never, {
      companyId: 'company-1',
      clientId: 'client-1',
      rentalId: 'rental-1',
      fineId: 'fine-1',
      fineAmountMinor: 375_000n,
      occurredAt: new Date('2026-10-21T08:30:00.000Z'),
    });

    expect(db.depositLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reservedDeltaMinor: 431_250n,
        debtDeltaMinor: 0n,
        commissionBasisPoints: 1500,
        idempotencyKey: 'fine-reservation:fine-1:rental-1',
      }),
    });
  });

  it('reserves only available money and records the rest as debt', async () => {
    const db = database([deposit(100_000n)]);

    await reserveFineFromDeposit(db as never, {
      companyId: 'company-1',
      clientId: 'client-1',
      rentalId: 'rental-1',
      fineId: 'fine-1',
      fineAmountMinor: 375_000n,
      occurredAt: new Date('2026-10-21T08:30:00.000Z'),
    });

    expect(db.depositLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reservedDeltaMinor: 100_000n,
        debtDeltaMinor: 331_250n,
      }),
    });
  });

  it('adjusts an unpaid fine without creating a second reservation', async () => {
    const db = databaseWithFineEntries(
      [
        deposit(1_000_000n),
        {
          cashDeltaMinor: 0n,
          reservedDeltaMinor: 431_250n,
          withheldDeltaMinor: 0n,
          debtDeltaMinor: 0n,
        },
      ],
      [{ reservedDeltaMinor: 431_250n, withheldDeltaMinor: 0n, debtDeltaMinor: 0n }],
    );

    await reconcileFineDepositReservation(db as never, {
      companyId: 'company-1',
      clientId: 'client-1',
      rentalId: 'rental-1',
      fineId: 'fine-1',
      fineAmountMinor: 400_000n,
      status: 'UNPAID',
      occurredAt: new Date('2026-10-22T08:30:00.000Z'),
    });

    expect(db.depositLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: 'FINE_RESERVATION_ADJUSTMENT',
        reservedDeltaMinor: 28_750n,
        withheldDeltaMinor: 0n,
        debtDeltaMinor: 0n,
      }),
    });
  });

  it('turns a paid fine reservation into withholding without reducing available twice', async () => {
    const db = databaseWithFineEntries(
      [
        deposit(1_000_000n),
        {
          cashDeltaMinor: 0n,
          reservedDeltaMinor: 431_250n,
          withheldDeltaMinor: 0n,
          debtDeltaMinor: 0n,
        },
      ],
      [{ reservedDeltaMinor: 431_250n, withheldDeltaMinor: 0n, debtDeltaMinor: 0n }],
    );

    await reconcileFineDepositReservation(db as never, {
      companyId: 'company-1',
      clientId: 'client-1',
      rentalId: 'rental-1',
      fineId: 'fine-1',
      fineAmountMinor: 375_000n,
      status: 'PAID',
      occurredAt: new Date('2026-10-22T08:30:00.000Z'),
    });

    expect(db.depositLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: 'FINE_WITHHOLDING',
        reservedDeltaMinor: -431_250n,
        withheldDeltaMinor: 431_250n,
        debtDeltaMinor: 0n,
      }),
    });
  });

  it('releases a cancelled unpaid fine but keeps finalized withholding untouched', async () => {
    const db = databaseWithFineEntries(
      [
        deposit(1_000_000n),
        {
          cashDeltaMinor: 0n,
          reservedDeltaMinor: 100_000n,
          withheldDeltaMinor: 250_000n,
          debtDeltaMinor: 81_250n,
        },
      ],
      [{ reservedDeltaMinor: 100_000n, withheldDeltaMinor: 250_000n, debtDeltaMinor: 81_250n }],
    );

    await reconcileFineDepositReservation(db as never, {
      companyId: 'company-1',
      clientId: 'client-1',
      rentalId: 'rental-1',
      fineId: 'fine-1',
      fineAmountMinor: 375_000n,
      status: 'CANCELLED',
      occurredAt: new Date('2026-10-22T08:30:00.000Z'),
    });

    expect(db.depositLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: 'FINE_RESERVATION_RELEASE',
        reservedDeltaMinor: -100_000n,
        withheldDeltaMinor: 0n,
        debtDeltaMinor: -81_250n,
      }),
    });
  });

  it('does not touch historical fines that have no reservation ledger', async () => {
    const db = databaseWithFineEntries([deposit(1_000_000n)], []);
    const result = await reconcileFineDepositReservation(db as never, {
      companyId: 'company-1',
      clientId: 'client-1',
      rentalId: 'rental-1',
      fineId: 'fine-1',
      fineAmountMinor: 375_000n,
      status: 'PAID',
      occurredAt: new Date('2026-10-22T08:30:00.000Z'),
    });
    expect(result).toBeNull();
    expect(db.depositLedgerEntry.create).not.toHaveBeenCalled();
  });
});
