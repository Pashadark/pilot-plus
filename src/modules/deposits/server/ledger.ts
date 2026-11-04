import {
  DepositLedgerEntryKind,
  DepositLedgerEntrySource,
  Prisma,
  type DepositLedgerEntry,
} from '@/database/generated/prisma';

import {
  projectDepositBalance,
  type DepositBalance,
  type DepositLedgerDelta,
} from '../domain/balance';

type LedgerEntryRow = DepositLedgerEntry;

export interface DepositLedgerEntryInput extends DepositLedgerDelta {
  companyId: string;
  clientId: string;
  rentalId: string;
  fineId?: string | null;
  paymentId?: string | null;
  operationId?: string | null;
  reversalOfId?: string | null;
  kind: DepositLedgerEntryKind;
  source: DepositLedgerEntrySource;
  commissionBasisPoints?: number | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  idempotencyKey: string;
  actorUserId?: string | null;
  occurredAt: Date;
}

type DepositLedgerDatabase = Pick<Prisma.TransactionClient, '$queryRaw' | 'depositLedgerEntry'>;

const deltaFields = [
  'cashDeltaMinor',
  'reservedDeltaMinor',
  'withheldDeltaMinor',
  'debtDeltaMinor',
] as const;

function matchesExisting(existing: LedgerEntryRow, input: DepositLedgerEntryInput): boolean {
  return (
    existing.companyId === input.companyId &&
    existing.clientId === input.clientId &&
    existing.rentalId === input.rentalId &&
    (existing.fineId ?? null) === (input.fineId ?? null) &&
    (existing.paymentId ?? null) === (input.paymentId ?? null) &&
    (existing.operationId ?? null) === (input.operationId ?? null) &&
    (existing.reversalOfId ?? null) === (input.reversalOfId ?? null) &&
    existing.kind === input.kind &&
    existing.source === input.source &&
    (existing.commissionBasisPoints ?? null) === (input.commissionBasisPoints ?? null) &&
    (existing.reason ?? null) === (input.reason ?? null) &&
    (existing.actorUserId ?? null) === (input.actorUserId ?? null) &&
    existing.occurredAt.getTime() === input.occurredAt.getTime() &&
    deltaFields.every((field) => existing[field] === input[field])
  );
}

async function lockRental(
  database: DepositLedgerDatabase,
  companyId: string,
  rentalId: string,
): Promise<void> {
  const lockKey = `${companyId}:${rentalId}`;
  await database.$queryRaw(
    Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
  );
}

async function readDeltas(
  database: DepositLedgerDatabase,
  companyId: string,
  rentalId: string,
): Promise<DepositLedgerDelta[]> {
  return database.depositLedgerEntry.findMany({
    where: { companyId, rentalId },
    select: {
      cashDeltaMinor: true,
      reservedDeltaMinor: true,
      withheldDeltaMinor: true,
      debtDeltaMinor: true,
    },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
  });
}

export async function getRentalDepositBalance(
  database: DepositLedgerDatabase,
  companyId: string,
  rentalId: string,
): Promise<DepositBalance> {
  return projectDepositBalance(await readDeltas(database, companyId, rentalId));
}

export async function appendDepositEntry(
  database: DepositLedgerDatabase,
  input: DepositLedgerEntryInput,
): Promise<LedgerEntryRow> {
  await lockRental(database, input.companyId, input.rentalId);

  const where = {
    companyId_idempotencyKey: {
      companyId: input.companyId,
      idempotencyKey: input.idempotencyKey,
    },
  };
  const existing = await database.depositLedgerEntry.findUnique({ where });
  if (existing) {
    if (!matchesExisting(existing, input)) {
      throw new Error('DEPOSIT_LEDGER_IDEMPOTENCY_CONFLICT');
    }
    return existing;
  }

  const current = await readDeltas(database, input.companyId, input.rentalId);
  projectDepositBalance([...current, input]);

  const data: Prisma.DepositLedgerEntryUncheckedCreateInput = input;
  return database.depositLedgerEntry.create({ data });
}
