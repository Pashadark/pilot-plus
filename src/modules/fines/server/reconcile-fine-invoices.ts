import 'server-only';

import type { FineInvoiceStatus, Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';

import { PAYMENT_AUDIT_ACTOR_SNAPSHOT } from './payment-audit';

type Count = { count: number };

export type FineInvoiceReconciliationCandidate = {
  id: string;
  companyId: string;
  status: Extract<FineInvoiceStatus, 'PENDING'>;
  updatedAt: Date;
};

type FineInvoiceReconciliationTransaction = {
  fineInvoice: {
    updateMany(args: Prisma.FineInvoiceUpdateManyArgs): Promise<Count>;
  };
  auditLog: {
    create(args: Prisma.AuditLogCreateArgs): Promise<unknown>;
  };
};

export type FineInvoiceReconciliationDatabase = {
  fineInvoice: {
    findMany(args: Prisma.FineInvoiceFindManyArgs): Promise<FineInvoiceReconciliationCandidate[]>;
  };
  $transaction<T>(
    operation: (transaction: FineInvoiceReconciliationTransaction) => Promise<T>,
  ): Promise<T>;
};

export type FineInvoiceReconciliationOptions = {
  database?: FineInvoiceReconciliationDatabase;
  now?: Date;
  batchSize?: number;
  staleAfterMs?: number;
};

export type FineInvoiceReconciliationResult = {
  reconciled: number;
  skipped: number;
  hasMore: boolean;
};

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;
const DEFAULT_STALE_AFTER_MS = 15 * 60_000;
const MAX_STALE_AFTER_MS = 24 * 60 * 60_000;

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value as number), min), max);
}

function defaultDatabase(): FineInvoiceReconciliationDatabase {
  return {
    fineInvoice: {
      findMany: (args) =>
        prisma.fineInvoice.findMany(args) as Promise<FineInvoiceReconciliationCandidate[]>,
    },
    $transaction: (operation) => prisma.$transaction((transaction) => operation(transaction)),
  };
}

/**
 * Reclaims only stale sandbox PENDING rows. The conditional update is the
 * ownership claim: a concurrent worker that no longer sees PENDING skips it.
 */
export async function reconcileStaleFineInvoices(
  options: FineInvoiceReconciliationOptions = {},
): Promise<FineInvoiceReconciliationResult> {
  const now = options.now ?? new Date();
  const batchSize = boundedInteger(options.batchSize, DEFAULT_BATCH_SIZE, 1, MAX_BATCH_SIZE);
  const staleAfterMs = boundedInteger(
    options.staleAfterMs,
    DEFAULT_STALE_AFTER_MS,
    1_000,
    MAX_STALE_AFTER_MS,
  );
  const staleBefore = new Date(now.getTime() - staleAfterMs);
  const database = options.database ?? defaultDatabase();
  const candidates = await database.fineInvoice.findMany({
    where: { status: 'PENDING', updatedAt: { lte: staleBefore } },
    orderBy: { updatedAt: 'asc' },
    take: batchSize + 1,
    select: { id: true, companyId: true, status: true, updatedAt: true },
  });

  let reconciled = 0;
  let skipped = 0;
  for (const candidate of candidates.slice(0, batchSize)) {
    const owned = await database.$transaction(async (transaction) => {
      const claimed = await transaction.fineInvoice.updateMany({
        where: {
          id: candidate.id,
          companyId: candidate.companyId,
          status: 'PENDING',
          updatedAt: candidate.updatedAt,
        },
        data: { status: 'ERROR' },
      });
      if (claimed.count !== 1) return false;

      await transaction.auditLog.create({
        data: {
          companyId: candidate.companyId,
          actorUserId: null,
          actorEmailSnapshot: PAYMENT_AUDIT_ACTOR_SNAPSHOT,
          action: 'UPDATE',
          entityType: 'FINE',
          entityId: candidate.id,
          entityLabel: 'Sandbox-счёт штрафов',
          changes: { status: 'ERROR', reason: 'STALE_PENDING', sandbox: true },
        },
        select: { id: true },
      });
      return true;
    });
    if (owned) reconciled += 1;
    else skipped += 1;
  }

  return {
    reconciled,
    skipped,
    hasMore: candidates.length > batchSize,
  };
}
