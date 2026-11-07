import { Prisma } from '@/database/generated/prisma';

import { appendDepositEntry, getRentalDepositBalance } from './ledger';

const COMMISSION_BASIS_POINTS = 1500;
const BASIS_POINTS_DENOMINATOR = 10_000n;

export function calculateFineCharge(fineAmountMinor: bigint) {
  if (fineAmountMinor <= 0n) throw new Error('INVALID_FINE_AMOUNT');
  const commissionAmountMinor =
    (fineAmountMinor * BigInt(COMMISSION_BASIS_POINTS) + BASIS_POINTS_DENOMINATOR - 1n) /
    BASIS_POINTS_DENOMINATOR;
  return {
    fineAmountMinor,
    commissionAmountMinor,
    totalAmountMinor: fineAmountMinor + commissionAmountMinor,
    commissionBasisPoints: COMMISSION_BASIS_POINTS,
  };
}

export interface FineDepositReservationInput {
  companyId: string;
  clientId: string;
  rentalId: string;
  fineId: string;
  fineAmountMinor: bigint;
  occurredAt: Date;
}

export interface FineDepositReconciliationInput extends FineDepositReservationInput {
  status: 'NEW' | 'UNPAID' | 'OVERDUE' | 'PAID' | 'CANCELLED' | 'ARCHIVED';
}

type FineLedgerDatabase = Parameters<typeof appendDepositEntry>[0];

export async function reserveFineFromDeposit(
  database: FineLedgerDatabase,
  input: FineDepositReservationInput,
) {
  await database.$queryRaw(
    Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`${input.companyId}:${input.rentalId}`}, 0))`,
  );
  const balance = await getRentalDepositBalance(database, input.companyId, input.rentalId);
  const charge = calculateFineCharge(input.fineAmountMinor);
  const reservedMinor =
    balance.availableMinor < charge.totalAmountMinor
      ? balance.availableMinor
      : charge.totalAmountMinor;
  const debtMinor = charge.totalAmountMinor - reservedMinor;

  return appendDepositEntry(database, {
    companyId: input.companyId,
    clientId: input.clientId,
    rentalId: input.rentalId,
    fineId: input.fineId,
    kind: 'FINE_RESERVATION',
    source: 'AUTOMATIC',
    cashDeltaMinor: 0n,
    reservedDeltaMinor: reservedMinor,
    withheldDeltaMinor: 0n,
    debtDeltaMinor: debtMinor,
    commissionBasisPoints: charge.commissionBasisPoints,
    reason: 'Автоматический резерв нового штрафа',
    metadata: {
      fineAmountMinor: charge.fineAmountMinor.toString(),
      commissionAmountMinor: charge.commissionAmountMinor.toString(),
      totalAmountMinor: charge.totalAmountMinor.toString(),
    },
    idempotencyKey: `fine-reservation:${input.fineId}:${input.rentalId}`,
    occurredAt: input.occurredAt,
  });
}

export async function reconcileFineDepositReservation(
  database: FineLedgerDatabase,
  input: FineDepositReconciliationInput,
) {
  await database.$queryRaw(
    Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`${input.companyId}:${input.rentalId}`}, 0))`,
  );
  const fineEntries = await database.depositLedgerEntry.findMany({
    where: { companyId: input.companyId, rentalId: input.rentalId, fineId: input.fineId },
    select: {
      reservedDeltaMinor: true,
      withheldDeltaMinor: true,
      debtDeltaMinor: true,
    },
  });
  if (fineEntries.length === 0) return null;

  const current = fineEntries.reduce(
    (sum, entry) => ({
      reservedMinor: sum.reservedMinor + entry.reservedDeltaMinor,
      withheldMinor: sum.withheldMinor + entry.withheldDeltaMinor,
      debtMinor: sum.debtMinor + entry.debtDeltaMinor,
    }),
    { reservedMinor: 0n, withheldMinor: 0n, debtMinor: 0n },
  );
  const balance = await getRentalDepositBalance(database, input.companyId, input.rentalId);
  const charge = calculateFineCharge(input.fineAmountMinor);

  let targetReservedMinor = current.reservedMinor;
  let targetWithheldMinor = current.withheldMinor;
  let targetDebtMinor = current.debtMinor;
  let kind: 'FINE_RESERVATION_ADJUSTMENT' | 'FINE_RESERVATION_RELEASE' | 'FINE_WITHHOLDING';
  let reason: string;

  if (input.status === 'CANCELLED' || input.status === 'ARCHIVED') {
    targetReservedMinor = 0n;
    targetDebtMinor = 0n;
    kind = 'FINE_RESERVATION_RELEASE';
    reason =
      input.status === 'ARCHIVED'
        ? 'Штраф перенесён в архив: провайдер больше не возвращает запись'
        : 'Освобождение резерва отменённого штрафа';
  } else if (input.status === 'PAID') {
    const securedCapacity = balance.availableMinor + current.reservedMinor + current.withheldMinor;
    targetWithheldMinor =
      securedCapacity < charge.totalAmountMinor ? securedCapacity : charge.totalAmountMinor;
    targetReservedMinor = 0n;
    targetDebtMinor = charge.totalAmountMinor - targetWithheldMinor;
    kind = 'FINE_WITHHOLDING';
    reason = 'Подтверждённая оплата штрафа: резерв переведён в удержание';
  } else {
    const amountStillRequired =
      charge.totalAmountMinor > current.withheldMinor
        ? charge.totalAmountMinor - current.withheldMinor
        : 0n;
    const reservable = balance.availableMinor + current.reservedMinor;
    targetReservedMinor = reservable < amountStillRequired ? reservable : amountStillRequired;
    targetDebtMinor = amountStillRequired - targetReservedMinor;
    kind = 'FINE_RESERVATION_ADJUSTMENT';
    reason = 'Корректировка резерва после обновления суммы штрафа';
  }

  const reservedDeltaMinor = targetReservedMinor - current.reservedMinor;
  const withheldDeltaMinor = targetWithheldMinor - current.withheldMinor;
  const debtDeltaMinor = targetDebtMinor - current.debtMinor;
  if (reservedDeltaMinor === 0n && withheldDeltaMinor === 0n && debtDeltaMinor === 0n) return null;

  return appendDepositEntry(database, {
    companyId: input.companyId,
    clientId: input.clientId,
    rentalId: input.rentalId,
    fineId: input.fineId,
    kind,
    source: 'AUTOMATIC',
    cashDeltaMinor: 0n,
    reservedDeltaMinor,
    withheldDeltaMinor,
    debtDeltaMinor,
    commissionBasisPoints: charge.commissionBasisPoints,
    reason,
    metadata: {
      fineStatus: input.status,
      fineAmountMinor: charge.fineAmountMinor.toString(),
      commissionAmountMinor: charge.commissionAmountMinor.toString(),
      totalAmountMinor: charge.totalAmountMinor.toString(),
    },
    idempotencyKey: [
      'fine-reconciliation',
      input.fineId,
      input.rentalId,
      input.status,
      input.fineAmountMinor,
      `${current.reservedMinor},${current.withheldMinor},${current.debtMinor}`,
      `${targetReservedMinor},${targetWithheldMinor},${targetDebtMinor}`,
    ].join(':'),
    occurredAt: input.occurredAt,
  });
}
