import type { FineLedgerDatabase } from '@/modules/deposits/server/fine-reservation';

type FineCandidate = {
  id: string;
  companyId: string;
  externalId: string;
  decreeNumber: string;
  status: string;
  archiveReason: string | null;
  clientId: string | null;
  rentalId: string | null;
  currentAmountMinor: bigint;
};

type ArchiveTransaction = FineLedgerDatabase & {
  fine: { update(args: unknown): Promise<unknown> };
  auditLog: { create(args: unknown): Promise<unknown> };
};

type ArchiveDatabase = {
  fine: { findMany(args: unknown): Promise<FineCandidate[]> };
  $transaction<T>(
    callback: (transaction: ArchiveTransaction) => Promise<T>,
    options?: { isolationLevel: 'Serializable' },
  ): Promise<T>;
};

type ReconcileReservation = (
  transaction: ArchiveTransaction,
  input: {
    companyId: string;
    clientId: string;
    rentalId: string;
    fineId: string;
    fineAmountMinor: bigint;
    status: 'ARCHIVED';
    occurredAt: Date;
  },
) => Promise<unknown>;

export async function archiveConfirmedFine(
  database: ArchiveDatabase,
  reconcileReservation: ReconcileReservation,
  input: { externalId: string; companyId?: string; now: Date },
) {
  const candidates = await database.fine.findMany({
    where: {
      provider: 'DRIVER_HELPER',
      externalId: input.externalId,
      ...(input.companyId ? { companyId: input.companyId } : {}),
    },
    select: {
      id: true,
      companyId: true,
      externalId: true,
      decreeNumber: true,
      status: true,
      archiveReason: true,
      clientId: true,
      rentalId: true,
      currentAmountMinor: true,
    },
    take: 2,
  });
  if (candidates.length === 0) throw new Error('Штраф Driver Helper не найден.');
  if (candidates.length > 1) {
    throw new Error('Найдено несколько штрафов; укажите --company-id.');
  }

  const fine = candidates[0]!;
  if (fine.status === 'ARCHIVED' && fine.archiveReason === 'MANUAL_CONFIRMED') {
    return {
      fineId: fine.id,
      decreeNumber: fine.decreeNumber,
      previousStatus: fine.status,
      result: 'ALREADY_ARCHIVED' as const,
    };
  }

  return database.$transaction(
    async (transaction) => {
      await transaction.fine.update({
        where: { id: fine.id },
        data: {
          status: 'ARCHIVED',
          archivedAt: input.now,
          archiveReason: 'MANUAL_CONFIRMED',
          providerMissingSince: null,
          providerMissingSyncCount: 0,
        },
        select: { id: true },
      });
      if (fine.clientId && fine.rentalId) {
        await reconcileReservation(transaction, {
          companyId: fine.companyId,
          clientId: fine.clientId,
          rentalId: fine.rentalId,
          fineId: fine.id,
          fineAmountMinor: fine.currentAmountMinor,
          status: 'ARCHIVED',
          occurredAt: input.now,
        });
      }
      await transaction.auditLog.create({
        data: {
          companyId: fine.companyId,
          actorUserId: null,
          actorEmailSnapshot: 'system@supapro.local',
          action: 'ARCHIVE',
          entityType: 'FINE',
          entityId: fine.id,
          entityLabel: 'Штраф',
          changes: {
            fromStatus: fine.status,
            toStatus: 'ARCHIVED',
            reason: 'MANUAL_CONFIRMED',
          },
        },
        select: { id: true },
      });
      return {
        fineId: fine.id,
        decreeNumber: fine.decreeNumber,
        previousStatus: fine.status,
        result: 'ARCHIVED' as const,
      };
    },
    { isolationLevel: 'Serializable' },
  );
}
