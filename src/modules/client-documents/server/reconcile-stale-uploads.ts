import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';
import type { PrivateStorage } from '@/services/storage/private-storage';

import { staleUploadThresholdMs } from './recovery-policy';

type Count = { count: number };

type StaleUpload = {
  id: string;
  uploadId: string | null;
  version: number;
  storageKey: string;
  sha256: string;
  scanVerdict: string | null;
  scanLeaseExpiresAt: Date | null;
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
  now?: Date;
  staleAfterMs?: number;
  cleanupRetryMs?: number;
  batchSize?: number;
};

export type StaleUploadReconciliationResult = {
  recovered: number;
  cleanupPending: number;
  staleFilesRemoved: number;
  hasMore: boolean;
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
  const now = options.now ?? new Date();
  const staleAfterMs = options.staleAfterMs ?? staleUploadThresholdMs();
  const cleanupRetryMs = options.cleanupRetryMs ?? defaultCleanupRetryMs;
  const cutoff = new Date(now.getTime() - staleAfterMs);
  const retryAt = new Date(now.getTime() + cleanupRetryMs);
  const database = options.database ?? prismaReconciliationDatabase();
  const storage = options.storage ?? (await LocalPrivateStorage.create(privateStorageRoot()));

  const batchSize = boundedBatchSize(options.batchSize ?? defaultBatchSize);
  const page = await database.clientDocumentVersion.findMany({
    where: {
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
        { scanVerdict: 'ERROR', scanLeaseExpiresAt: { lte: now } },
      ],
    },
    select: {
      id: true,
      uploadId: true,
      version: true,
      storageKey: true,
      sha256: true,
      scanVerdict: true,
      scanLeaseExpiresAt: true,
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

  for (const candidate of candidates) {
    if (!candidate.uploadId) continue;
    let claimed = candidate.scanVerdict === 'ERROR';

    if (!claimed) {
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
            OR: [
              { scanLeaseExpiresAt: { lte: now } },
              { scanLeaseExpiresAt: null, createdAt: { lte: cutoff } },
            ],
          },
          data: {
            scanVerdict: 'ERROR',
            scannedAt: now,
            scanLeaseExpiresAt: retryAt,
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
    const cleanup = await Promise.allSettled([
      storage.removeUploadArtifacts(candidate.uploadId),
      removePrivateIfPresent(storage, candidate.storageKey),
    ]);
    if (cleanup[0]?.status === 'fulfilled') staleFilesRemoved += cleanup[0].value;
    const cleaned = cleanup.every((result) => result.status === 'fulfilled');
    if (!cleaned) cleanupPending += 1;

    await database.clientDocumentVersion.updateMany({
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
      },
      data: { scanLeaseExpiresAt: cleaned ? null : retryAt },
    });
  }

  return { recovered, cleanupPending, staleFilesRemoved, hasMore };
}
