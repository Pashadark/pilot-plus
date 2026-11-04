import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/database/prisma/client', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('@/modules/rentals/server/access', () => ({
  requireRentalAccess: async () => ({ user: { id: 'u', email: 'u@example.test', name: 'Оператор' } }),
  RentalAccessDeniedError: class extends Error {},
}));
import { returnRentalDepositAction } from './actions';
it('records deposit return without photos with amounts, reason, time and audit', async () => {
  const create = vi.fn(async ({ data }) => {
    if (data.evidenceStatus !== 'COMPLETE' && !data.evidenceMissingReason) throw new Error('Invalid `prisma. evidence_reason_check');
    return { id: 'operation-1' };
  });
  const tx = {
    rental: { findFirst: vi.fn().mockResolvedValue({ id: 'r', clientId: 'c', vehicleId: 'v', payments: [{ amountMinor: BigInt(2000000) }], operations: [] }) },
    rentalOperation: { create }, auditLog: { create: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ locked: true }]),
    depositLedgerEntry: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([{
        cashDeltaMinor: 2_000_000n,
        reservedDeltaMinor: 0n,
        withheldDeltaMinor: 0n,
        debtDeltaMinor: 0n,
      }]),
      create: vi.fn(async ({ data }) => ({ id: 'ledger-return-1', ...data })),
    },
    telegramGroupBinding: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  mocks.transaction.mockImplementation(async work => work(tx));
  const form = new FormData();
  form.set('companyId', 'co'); form.set('rentalId', 'r');
  form.set('returnedRubles', '13880'); form.set('reason', 'Бензин, штраф');
  expect(await returnRentalDepositAction(null, form)).toMatchObject({ ok: true });
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
    type: 'DEPOSIT_RETURN', depositAmountMinor: BigInt(2000000), depositWithheldMinor: BigInt(612000),
    depositResolutionReason: 'Бензин, штраф', occurredAt: expect.any(Date), actorUserId: 'u',
  }) }));
  expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ changes: expect.objectContaining({ returnedMinor: '1388000', reason: 'Бензин, штраф' }) }) }));
  expect(tx.depositLedgerEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({
    operationId: 'operation-1', kind: 'DEPOSIT_RETURN', source: 'STAFF',
    cashDeltaMinor: -1_388_000n, withheldDeltaMinor: 612_000n,
    reason: 'Бензин, штраф', actorUserId: 'u',
  }) });
});

it('moves a fine reservation to debt when staff already returned the full deposit', async () => {
  const ledgerRows: Array<{
    fineId?: string | null;
    cashDeltaMinor: bigint;
    reservedDeltaMinor: bigint;
    withheldDeltaMinor: bigint;
    debtDeltaMinor: bigint;
    occurredAt?: Date;
  }> = [
    {
      cashDeltaMinor: 2_000_000n,
      reservedDeltaMinor: 0n,
      withheldDeltaMinor: 0n,
      debtDeltaMinor: 0n,
    },
    {
      fineId: 'fine-1',
      cashDeltaMinor: 0n,
      reservedDeltaMinor: 64_688n,
      withheldDeltaMinor: 0n,
      debtDeltaMinor: 0n,
      occurredAt: new Date('2026-10-22T19:22:02.304Z'),
    },
  ];
  const ledgerCreate = vi.fn(async ({ data }) => {
    ledgerRows.push(data);
    return { id: `ledger-${ledgerRows.length}`, ...data };
  });
  const ledgerFindMany = vi.fn(async (args) => {
    if (args?.select?.fineId) {
      return ledgerRows
        .filter((entry) => entry.fineId)
        .map((entry) => ({
          fineId: entry.fineId,
          reservedDeltaMinor: entry.reservedDeltaMinor,
          occurredAt: entry.occurredAt ?? new Date('2026-10-22T19:22:02.304Z'),
        }));
    }
    return ledgerRows;
  });
  const tx = {
    rental: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'r',
        clientId: 'c',
        vehicleId: 'v',
        contractNumber: 'ME-2026-0050-AA',
        payments: [{ amountMinor: 2_000_000n }],
        operations: [],
      }),
    },
    rentalOperation: { create: vi.fn().mockResolvedValue({ id: 'operation-1' }) },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ locked: true }]),
    depositLedgerEntry: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: ledgerFindMany,
      create: ledgerCreate,
    },
    telegramGroupBinding: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  mocks.transaction.mockImplementation(async (work) => work(tx));
  const form = new FormData();
  form.set('companyId', 'co');
  form.set('rentalId', 'r');
  form.set('returnedRubles', '20000');
  form.set('reason', '');

  expect(await returnRentalDepositAction(null, form)).toMatchObject({ ok: true });
  expect(ledgerCreate).toHaveBeenCalledWith({
    data: expect.objectContaining({
      fineId: 'fine-1',
      kind: 'FINE_RESERVATION_ADJUSTMENT',
      reservedDeltaMinor: -64_688n,
      debtDeltaMinor: 64_688n,
    }),
  });
  expect(ledgerCreate).toHaveBeenCalledWith({
    data: expect.objectContaining({
      operationId: 'operation-1',
      kind: 'DEPOSIT_RETURN',
      cashDeltaMinor: -2_000_000n,
      withheldDeltaMinor: 0n,
    }),
  });
});
