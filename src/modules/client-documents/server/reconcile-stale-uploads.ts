import { randomUUID } from 'node:crypto';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { scanPendingUpload } from '@/modules/client-documents/scan-upload';
import { ClamAvClient } from '@/services/malware-scanner/clamav-client';
import type { MalwareScanner } from '@/services/malware-scanner/types';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';
import type { PrivateStorage } from '@/services/storage/private-storage';
import {
  settleClientUploadPermitInTransaction,
  type UploadPermitTransaction,
} from './upload-resource-controls';

import {
  maxQuarantineScanRetries,
  quarantineRetentionMs,
  scanRetryDelayMs,
  staleUploadThresholdMs,
} from './recovery-policy';

type Count = { count: number };

type StaleUpload = {
  id: string;
  uploadId: string | null;
  version: number;
  storageKey: string;
  sha256: string;
  bytes: number;
  ledgerCommittedBytes: number;
  scanVerdict: string | null;
  scanLeaseExpiresAt: Date | null;
  claimToken: string | null;
  scanRetryCount: number;
  quarantineExpiresAt: Date | null;
  cleanupPending: boolean;
  cleanupLeaseExpiresAt: Date | null;
  createdAt: Date;
  document: {
    id: string;
    companyId: string;
    clientId: string;
    currentVersion: number;
    status: string;
    archivedAt: Date | null;
  };
};

type ReconciliationTransaction = {
  clientDocumentVersion: { updateMany(args: unknown): Promise<Count> };
  clientDocument: { updateMany(args: unknown): Promise<Count> };
  auditLog: { create(args: unknown): Promise<unknown> };
  clientUploadPermit: {
    findFirst(args: unknown): Promise<{ reservedBytes: number } | null>;
    updateMany(args: unknown): Promise<Count>;
  };
  clientStorageLedger: { updateMany(args: unknown): Promise<Count> };
};

export type ReconciliationDatabase = ReconciliationTransaction & {
  clientDocumentVersion: ReconciliationTransaction['clientDocumentVersion'] & {
    findMany(args: unknown): Promise<StaleUpload[]>;
  };
  $transaction<T>(operation: (transaction: ReconciliationTransaction) => Promise<T>): Promise<T>;
};

type ReconciliationOptions = {
  database?: ReconciliationDatabase;
  storage?: PrivateStorage;
  scanner?: MalwareScanner;
  now?: Date;
  clock?: () => Date;
  staleAfterMs?: number;
  cleanupRetryMs?: number;
  batchSize?: number;
};

export type StaleUploadReconciliationResult = {
  recovered: number;
  cleanupPending: number;
  staleFilesRemoved: number;
  hasMore: boolean;
  retried: number;
  retryPending: number;
  expired: number;
  archivedCleaned: number;
};

const defaultCleanupRetryMs = 5 * 60_000;
const defaultBatchSize = 100;
const maximumBatchSize = 500;

function prismaReconciliationDatabase(): ReconciliationDatabase {
  return {
    clientDocumentVersion: {
      findMany: async (args) =>
        (await prisma.clientDocumentVersion.findMany(
          args as Prisma.ClientDocumentVersionFindManyArgs,
        )) as unknown as StaleUpload[],
      updateMany: (args) =>
        prisma.clientDocumentVersion.updateMany(args as Prisma.ClientDocumentVersionUpdateManyArgs),
    },
    clientDocument: {
      updateMany: (args) =>
        prisma.clientDocument.updateMany(args as Prisma.ClientDocumentUpdateManyArgs),
    },
    auditLog: {
      create: (args) => prisma.auditLog.create(args as Prisma.AuditLogCreateArgs),
    },
    clientUploadPermit: {
      findFirst: (args) =>
        prisma.clientUploadPermit.findFirst(
          args as Prisma.ClientUploadPermitFindFirstArgs,
        ) as Promise<{ reservedBytes: number } | null>,
      updateMany: (args) =>
        prisma.clientUploadPermit.updateMany(args as Prisma.ClientUploadPermitUpdateManyArgs),
    },
    clientStorageLedger: {
      updateMany: (args) =>
        prisma.clientStorageLedger.updateMany(args as Prisma.ClientStorageLedgerUpdateManyArgs),
    },
    $transaction: (operation) =>
      prisma.$transaction((transaction) =>
        operation({
          clientDocumentVersion: {
            updateMany: (args) =>
              transaction.clientDocumentVersion.updateMany(
                args as Prisma.ClientDocumentVersionUpdateManyArgs,
              ),
          },
          clientDocument: {
            updateMany: (args) =>
              transaction.clientDocument.updateMany(args as Prisma.ClientDocumentUpdateManyArgs),
          },
          auditLog: {
            create: (args) => transaction.auditLog.create(args as Prisma.AuditLogCreateArgs),
          },
          clientUploadPermit: {
            findFirst: (args) =>
              transaction.clientUploadPermit.findFirst(
                args as Prisma.ClientUploadPermitFindFirstArgs,
              ) as Promise<{ reservedBytes: number } | null>,
            updateMany: (args) =>
              transaction.clientUploadPermit.updateMany(
                args as Prisma.ClientUploadPermitUpdateManyArgs,
              ),
          },
          clientStorageLedger: {
            updateMany: (args) =>
              transaction.clientStorageLedger.updateMany(
                args as Prisma.ClientStorageLedgerUpdateManyArgs,
              ),
          },
        }),
      ),
  };
}

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('Приватное хранилище не настроено.');
  return root;
}

function missingFile(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

async function removePrivateIfPresent(storage: PrivateStorage, storageKey: string) {
  try {
    await storage.removePrivate(storageKey);
  } catch (error) {
    if (!missingFile(error)) throw error;
  }
}

function boundedBatchSize(value: number) {
  if (!Number.isFinite(value)) return defaultBatchSize;
  return Math.min(maximumBatchSize, Math.max(1, Math.trunc(value)));
}

export async function reconcileStaleClientDocumentUploads(
  options: ReconciliationOptions = {},
): Promise<StaleUploadReconciliationResult> {
  const clock = options.clock ?? (options.now ? () => options.now as Date : () => new Date());
  const now = options.now ?? clock();
  const staleAfterMs = options.staleAfterMs ?? staleUploadThresholdMs();
  const cleanupRetryMs = options.cleanupRetryMs ?? defaultCleanupRetryMs;
  const cutoff = new Date(now.getTime() - staleAfterMs);
  const database = options.database ?? prismaReconciliationDatabase();
  const storage = options.storage ?? (await LocalPrivateStorage.create(privateStorageRoot()));

  const batchSize = boundedBatchSize(options.batchSize ?? defaultBatchSize);
  const page = await database.clientDocumentVersion.findMany({
    where: {
      OR: [
        {
          cleanupPending: true,
          OR: [
            { cleanupLeaseExpiresAt: { lte: now } },
            { cleanupLeaseExpiresAt: null, createdAt: { lte: cutoff } },
          ],
        },
        {
          uploadId: { not: null },
          document: { archivedAt: null },
          OR: [
            {
              scanVerdict: null,
              OR: [
                { scanLeaseExpiresAt: { lte: now } },
                { scanLeaseExpiresAt: null, createdAt: { lte: cutoff } },
              ],
            },
            {
              scanVerdict: 'ERROR',
              OR: [
                { scanLeaseExpiresAt: { lte: now } },
                { scanLeaseExpiresAt: null, createdAt: { lte: cutoff } },
              ],
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      uploadId: true,
      version: true,
      storageKey: true,
      sha256: true,
      bytes: true,
      ledgerCommittedBytes: true,
      scanVerdict: true,
      scanLeaseExpiresAt: true,
      claimToken: true,
      scanRetryCount: true,
      quarantineExpiresAt: true,
      cleanupPending: true,
      cleanupLeaseExpiresAt: true,
      createdAt: true,
      document: {
        select: {
          id: true,
          companyId: true,
          clientId: true,
          currentVersion: true,
          status: true,
          archivedAt: true,
        },
      },
    },
    orderBy: [{ scanLeaseExpiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    take: batchSize + 1,
  });
  const hasMore = page.length > batchSize;
  const candidates = page.slice(0, batchSize);

  let recovered = 0;
  let cleanupPending = 0;
  let staleFilesRemoved = 0;
  let retried = 0;
  let retryPending = 0;
  let expired = 0;
  let archivedCleaned = 0;

  for (const candidate of candidates) {
    if (candidate.cleanupPending) {
      const claimToken = randomUUID();
      let ownedLease = new Date(clock().getTime() + cleanupRetryMs);
      const claimed = await database.clientDocumentVersion.updateMany({
        where: {
          id: candidate.id,
          cleanupPending: true,
          claimToken: candidate.claimToken,
          OR: [
            { cleanupLeaseExpiresAt: { lte: now } },
            { cleanupLeaseExpiresAt: null, createdAt: { lte: cutoff } },
          ],
        },
        data: { claimToken, cleanupLeaseExpiresAt: ownedLease },
      });
      if (claimed.count !== 1) continue;
      const mutationAt = clock();
      const mutationLease = new Date(mutationAt.getTime() + cleanupRetryMs);
      const ownsMutation = await database.clientDocumentVersion.updateMany({
        where: {
          id: candidate.id,
          cleanupPending: true,
          claimToken,
          cleanupLeaseExpiresAt: ownedLease,
          AND: { cleanupLeaseExpiresAt: { gt: mutationAt } },
        },
        data: { cleanupLeaseExpiresAt: mutationLease },
      });
      if (ownsMutation.count !== 1) continue;
      ownedLease = mutationLease;
      const cleanup = await Promise.allSettled([
        removePrivateIfPresent(storage, candidate.storageKey),
        ...(candidate.uploadId ? [storage.removeUploadArtifacts(candidate.uploadId)] : []),
      ]);
      const cleaned = cleanup.every((result) => result.status === 'fulfilled');
      if (!cleaned) cleanupPending += 1;
      if (cleaned) {
        const finalizedAt = clock();
        const committed = await database.$transaction(async (transaction) => {
          const version = await transaction.clientDocumentVersion.updateMany({
            where: {
              id: candidate.id,
              cleanupPending: true,
              claimToken,
              cleanupLeaseExpiresAt: ownedLease,
            },
            data: {
              cleanupPending: false,
              cleanupLeaseExpiresAt: null,
              claimToken: null,
              storageDeletedAt: finalizedAt,
              ledgerCommittedBytes: 0,
            },
          });
          if (version.count !== 1) return false;
          if (candidate.ledgerCommittedBytes > 0) {
            const ledger = await transaction.clientStorageLedger.updateMany({
              where: {
                companyId: candidate.document.companyId,
                committedBytes: { gte: BigInt(candidate.ledgerCommittedBytes) },
              },
              data: { committedBytes: { decrement: BigInt(candidate.ledgerCommittedBytes) } },
            });
            if (ledger.count !== 1) throw new Error('Storage ledger drift.');
          }
          if (candidate.uploadId) {
            await settleClientUploadPermitInTransaction(
              transaction as unknown as UploadPermitTransaction,
              {
                uploadId: candidate.uploadId,
                companyId: candidate.document.companyId,
                status: 'RELEASED',
                now: finalizedAt,
                committedBytes: 0,
              },
            );
          }
          return true;
        });
        if (committed) archivedCleaned += 1;
      } else {
        const current = clock();
        await database.clientDocumentVersion.updateMany({
          where: {
            id: candidate.id,
            cleanupPending: true,
            claimToken,
            cleanupLeaseExpiresAt: ownedLease,
          },
          data: {
            claimToken: null,
            cleanupLeaseExpiresAt: new Date(current.getTime() + cleanupRetryMs),
          },
        });
      }
      continue;
    }

    if (!candidate.uploadId) continue;
    const quarantineExpiresAt =
      candidate.quarantineExpiresAt ??
      new Date(candidate.createdAt.getTime() + quarantineRetentionMs());
    const obsoleteReplacement =
      candidate.scanVerdict === 'ERROR' && candidate.version < candidate.document.currentVersion;
    const canRetry =
      candidate.scanVerdict === 'ERROR' &&
      !obsoleteReplacement &&
      candidate.scanRetryCount < maxQuarantineScanRetries() &&
      quarantineExpiresAt > now;
    if (canRetry) {
      const claimToken = randomUUID();
      let ownedLease = new Date(clock().getTime() + staleAfterMs);
      const claim = await database.clientDocumentVersion.updateMany({
        where: {
          id: candidate.id,
          uploadId: candidate.uploadId,
          scanVerdict: 'ERROR',
          claimToken: candidate.claimToken,
          OR: [
            { scanLeaseExpiresAt: { lte: now } },
            { scanLeaseExpiresAt: null, createdAt: { lte: cutoff } },
          ],
          document: {
            companyId: candidate.document.companyId,
            clientId: candidate.document.clientId,
            archivedAt: null,
          },
        },
        data: {
          claimToken,
          scanLeaseExpiresAt: ownedLease,
          scanRetryCount: { increment: 1 },
        },
      });
      if (claim.count !== 1) continue;
      retried += 1;
      const renewClaim = async () => {
        const current = clock();
        const renewedLease = new Date(current.getTime() + staleAfterMs);
        const renewed = await database.clientDocumentVersion.updateMany({
          where: {
            id: candidate.id,
            uploadId: candidate.uploadId,
            scanVerdict: 'ERROR',
            claimToken,
            scanLeaseExpiresAt: ownedLease,
            AND: { scanLeaseExpiresAt: { gt: current } },
          },
          data: { scanLeaseExpiresAt: renewedLease },
        });
        if (renewed.count === 1) ownedLease = renewedLease;
        return renewed.count === 1;
      };
      const result = await scanPendingUpload({
        storage,
        scanner: options.scanner ?? ClamAvClient.fromEnvironment(),
        uploadId: candidate.uploadId,
        storageKey: candidate.storageKey,
        renewMutationLease: renewClaim,
      }).catch(() => ({
        status: 'ERROR' as const,
        audit: { sha256: candidate.sha256, verdict: 'ERROR' as const },
      }));

      if (result.status === 'ERROR') {
        retryPending += 1;
        const current = clock();
        await database.clientDocumentVersion.updateMany({
          where: {
            id: candidate.id,
            uploadId: candidate.uploadId,
            scanVerdict: 'ERROR',
            claimToken,
            scanLeaseExpiresAt: ownedLease,
          },
          data: {
            claimToken: null,
            scanLeaseExpiresAt: new Date(
              current.getTime() + scanRetryDelayMs(candidate.scanRetryCount + 1),
            ),
          },
        });
        continue;
      }

      try {
        if (!(await renewClaim())) throw new Error('Retry ownership lost.');
        const finalizedAt = clock();
        await database.$transaction(async (transaction) => {
          const version = await transaction.clientDocumentVersion.updateMany({
            where: {
              id: candidate.id,
              uploadId: candidate.uploadId,
              scanVerdict: 'ERROR',
              claimToken,
              scanLeaseExpiresAt: ownedLease,
              AND: { scanLeaseExpiresAt: { gt: finalizedAt } },
            },
            data: {
              scanVerdict: result.status,
              scanLeaseExpiresAt: null,
              claimToken: null,
              quarantineExpiresAt: null,
              scannedAt: finalizedAt,
              sha256: result.audit.sha256,
              scanEngine: result.audit.engine ?? 'ClamAV',
              signatureVersion: result.audit.signatureVersion ?? null,
              ledgerCommittedBytes: result.status === 'CLEAN' ? candidate.bytes : 0,
            },
          });
          if (version.count !== 1) throw new Error('Состояние версии изменилось.');
          if (candidate.version === candidate.document.currentVersion) {
            const document = await transaction.clientDocument.updateMany({
              where: {
                id: candidate.document.id,
                companyId: candidate.document.companyId,
                clientId: candidate.document.clientId,
                currentVersion: candidate.version,
                status: 'ERROR',
                archivedAt: null,
              },
              data: { status: result.status },
            });
            if (document.count !== 1) throw new Error('Состояние документа изменилось.');
          } else if (result.status === 'CLEAN') {
            const document = await transaction.clientDocument.updateMany({
              where: {
                id: candidate.document.id,
                companyId: candidate.document.companyId,
                clientId: candidate.document.clientId,
                currentVersion: candidate.document.currentVersion,
                status: 'CLEAN',
                archivedAt: null,
              },
              data: { currentVersion: candidate.version },
            });
            if (document.count !== 1) throw new Error('Состояние документа изменилось.');
          }
          await transaction.auditLog.create({
            data: {
              actorUserId: null,
              actorEmailSnapshot: 'system@pilot-plus.local',
              companyId: candidate.document.companyId,
              action: 'SCAN',
              entityType: 'CLIENT_DOCUMENT',
              entityId: candidate.document.id,
              entityLabel: 'Документ клиента',
              changes: {
                sha256: result.audit.sha256,
                verdict: result.status,
                reason: 'QUARANTINE_RETRY',
                version: candidate.version,
                ...(result.audit.signatureVersion
                  ? { signatureVersion: result.audit.signatureVersion }
                  : {}),
                ...(result.audit.signature ? { threat: result.audit.signature } : {}),
              },
            },
            select: { id: true },
          });
          const settled = await settleClientUploadPermitInTransaction(
            transaction as unknown as UploadPermitTransaction,
            {
              uploadId: candidate.uploadId as string,
              companyId: candidate.document.companyId,
              status: 'COMPLETED',
              now: finalizedAt,
              committedBytes: result.status === 'CLEAN' ? candidate.bytes : 0,
            },
          );
          if (!settled) throw new Error('Upload permit ownership lost.');
        });
      } catch {
        if (result.status === 'CLEAN' && (await renewClaim().catch(() => false))) {
          await removePrivateIfPresent(storage, candidate.storageKey);
        }
        retryPending += 1;
      }
      continue;
    }

    let claimed = false;
    const claimToken = randomUUID();
    let ownedLease = new Date(clock().getTime() + cleanupRetryMs);

    if (candidate.scanVerdict === 'ERROR') {
      const claim = await database.clientDocumentVersion.updateMany({
        where: {
          id: candidate.id,
          uploadId: candidate.uploadId,
          scanVerdict: 'ERROR',
          claimToken: candidate.claimToken,
          OR: [
            { scanLeaseExpiresAt: { lte: now } },
            { scanLeaseExpiresAt: null, createdAt: { lte: cutoff } },
          ],
          document: {
            companyId: candidate.document.companyId,
            clientId: candidate.document.clientId,
            archivedAt: null,
          },
        },
        data: { claimToken, scanLeaseExpiresAt: ownedLease },
      });
      claimed = claim.count === 1;
    }

    if (candidate.scanVerdict === null) {
      claimed = await database.$transaction(async (transaction) => {
        const version = await transaction.clientDocumentVersion.updateMany({
          where: {
            id: candidate.id,
            uploadId: candidate.uploadId,
            documentId: candidate.document.id,
            document: {
              companyId: candidate.document.companyId,
              clientId: candidate.document.clientId,
              archivedAt: null,
            },
            scanVerdict: null,
            claimToken: candidate.claimToken,
            OR: [
              { scanLeaseExpiresAt: { lte: now } },
              { scanLeaseExpiresAt: null, createdAt: { lte: cutoff } },
            ],
          },
          data: {
            scanVerdict: 'ERROR',
            scannedAt: now,
            claimToken,
            scanLeaseExpiresAt: ownedLease,
          },
        });
        if (version.count !== 1) return false;

        if (
          candidate.version === candidate.document.currentVersion &&
          (candidate.document.status === 'UPLOADING' || candidate.document.status === 'PENDING')
        ) {
          const document = await transaction.clientDocument.updateMany({
            where: {
              id: candidate.document.id,
              companyId: candidate.document.companyId,
              clientId: candidate.document.clientId,
              currentVersion: candidate.version,
              status: { in: ['UPLOADING', 'PENDING'] },
              archivedAt: null,
            },
            data: { status: 'ERROR' },
          });
          if (document.count !== 1) throw new Error('Состояние документа изменилось.');
        }

        await transaction.auditLog.create({
          data: {
            actorUserId: null,
            actorEmailSnapshot: 'system@pilot-plus.local',
            companyId: candidate.document.companyId,
            action: 'SCAN',
            entityType: 'CLIENT_DOCUMENT',
            entityId: candidate.document.id,
            entityLabel: 'Документ клиента',
            changes: {
              sha256: candidate.sha256,
              verdict: 'ERROR',
              reason: 'STALE_SCAN_LEASE',
              version: candidate.version,
            },
          },
          select: { id: true },
        });
        return true;
      });
      if (claimed) recovered += 1;
    }

    if (!claimed) continue;
    if (candidate.scanVerdict === 'ERROR') expired += 1;
    const mutationAt = clock();
    const mutationLease = new Date(mutationAt.getTime() + cleanupRetryMs);
    const ownsMutation = await database.clientDocumentVersion.updateMany({
      where: {
        id: candidate.id,
        uploadId: candidate.uploadId,
        scanVerdict: 'ERROR',
        claimToken,
        scanLeaseExpiresAt: ownedLease,
        AND: { scanLeaseExpiresAt: { gt: mutationAt } },
      },
      data: { scanLeaseExpiresAt: mutationLease },
    });
    if (ownsMutation.count !== 1) continue;
    ownedLease = mutationLease;
    const cleanup = await Promise.allSettled([
      storage.removeUploadArtifacts(candidate.uploadId),
      removePrivateIfPresent(storage, candidate.storageKey),
    ]);
    if (cleanup[0]?.status === 'fulfilled') staleFilesRemoved += cleanup[0].value;
    const cleaned = cleanup.every((result) => result.status === 'fulfilled');
    if (!cleaned) cleanupPending += 1;

    if (cleaned) {
      const finalizedAt = clock();
      await database.$transaction(async (transaction) => {
        const version = await transaction.clientDocumentVersion.updateMany({
          where: {
            id: candidate.id,
            uploadId: candidate.uploadId,
            documentId: candidate.document.id,
            document: {
              companyId: candidate.document.companyId,
              clientId: candidate.document.clientId,
              archivedAt: null,
            },
            scanVerdict: 'ERROR',
            claimToken,
            scanLeaseExpiresAt: ownedLease,
          },
          data: {
            claimToken: null,
            scanLeaseExpiresAt: null,
            storageDeletedAt: finalizedAt,
            ledgerCommittedBytes: 0,
          },
        });
        if (version.count !== 1) throw new Error('Cleanup ownership lost.');
        if (candidate.ledgerCommittedBytes > 0) {
          const ledger = await transaction.clientStorageLedger.updateMany({
            where: {
              companyId: candidate.document.companyId,
              committedBytes: { gte: BigInt(candidate.ledgerCommittedBytes) },
            },
            data: { committedBytes: { decrement: BigInt(candidate.ledgerCommittedBytes) } },
          });
          if (ledger.count !== 1) throw new Error('Storage ledger drift.');
        }
        await settleClientUploadPermitInTransaction(
          transaction as unknown as UploadPermitTransaction,
          {
            uploadId: candidate.uploadId as string,
            companyId: candidate.document.companyId,
            status: 'RELEASED',
            now: finalizedAt,
            committedBytes: 0,
          },
        );
      });
    } else {
      const current = clock();
      await database.clientDocumentVersion.updateMany({
        where: {
          id: candidate.id,
          uploadId: candidate.uploadId,
          scanVerdict: 'ERROR',
          claimToken,
          scanLeaseExpiresAt: ownedLease,
        },
        data: {
          claimToken: null,
          scanLeaseExpiresAt: new Date(current.getTime() + cleanupRetryMs),
        },
      });
    }
  }

  return {
    recovered,
    cleanupPending,
    staleFilesRemoved,
    hasMore,
    retried,
    retryPending,
    expired,
    archivedCleaned,
  };
}
