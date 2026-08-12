import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';
import type { PrivateStorage } from '@/services/storage/private-storage';

import { staleUploadThresholdMs } from './recovery-policy';
import {
  settleClientUploadPermitInTransaction,
  type UploadPermitTransaction,
} from './upload-resource-controls';

type Count = { count: number };
type PhotoUpload = {
  id: string;
  uploadId: string;
  companyId: string;
  clientId: string;
  sourceStorageKey: string;
  finalStorageKey: string;
  previousPhotoPath: string | null;
  finalBytes: number | null;
  previousPhotoBytes: number;
  ledgerCommittedBytes: number;
  status: string;
  sha256: string | null;
  leaseExpiresAt: Date | null;
  committedAt: Date | null;
  createdAt: Date;
};

type PhotoReconciliationTransaction = {
  clientPhotoUpload: { updateMany(args: unknown): Promise<Count> };
  clientUploadPermit: {
    findFirst(args: unknown): Promise<{ reservedBytes: number } | null>;
    updateMany(args: unknown): Promise<Count>;
  };
  clientStorageLedger: { updateMany(args: unknown): Promise<Count> };
  auditLog: { create(args: unknown): Promise<unknown> };
};

export type PhotoReconciliationDatabase = PhotoReconciliationTransaction & {
  clientPhotoUpload: PhotoReconciliationTransaction['clientPhotoUpload'] & {
    findMany(args: unknown): Promise<PhotoUpload[]>;
  };
  client: {
    findFirst(args: unknown): Promise<{ photoPath: string | null; photoBytes: number } | null>;
  };
  $transaction<T>(
    operation: (transaction: PhotoReconciliationTransaction) => Promise<T>,
  ): Promise<T>;
};

type Options = {
  database?: PhotoReconciliationDatabase;
  storage?: PrivateStorage;
  now?: Date;
  staleAfterMs?: number;
  cleanupRetryMs?: number;
  batchSize?: number;
};

export type PhotoUploadReconciliationResult = {
  reconciled: number;
  cleanupPending: number;
  hasMore: boolean;
};

const defaultBatchSize = 100;
const maximumBatchSize = 500;
const defaultCleanupRetryMs = 5 * 60_000;

function databaseAdapter(): PhotoReconciliationDatabase {
  return {
    clientPhotoUpload: {
      findMany: async (args) =>
        (await prisma.clientPhotoUpload.findMany(
          args as Prisma.ClientPhotoUploadFindManyArgs,
        )) as PhotoUpload[],
      updateMany: (args) =>
        prisma.clientPhotoUpload.updateMany(args as Prisma.ClientPhotoUploadUpdateManyArgs),
    },
    client: {
      findFirst: (args) =>
        prisma.client.findFirst(args as Prisma.ClientFindFirstArgs) as Promise<{
          photoPath: string | null;
          photoBytes: number;
        } | null>,
    },
    auditLog: { create: (args) => prisma.auditLog.create(args as Prisma.AuditLogCreateArgs) },
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
          clientPhotoUpload: {
            updateMany: (args) =>
              transaction.clientPhotoUpload.updateMany(
                args as Prisma.ClientPhotoUploadUpdateManyArgs,
              ),
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

function boundedBatchSize(value: number) {
  if (!Number.isFinite(value)) return defaultBatchSize;
  return Math.min(maximumBatchSize, Math.max(1, Math.trunc(value)));
}

function missingFile(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

async function removePrivateIfPresent(storage: PrivateStorage, key: string | null) {
  if (!key?.startsWith('companies/')) return;
  try {
    await storage.removePrivate(key);
  } catch (error) {
    if (!missingFile(error)) throw error;
  }
}

export async function reconcileStaleClientPhotoUploads(
  options: Options = {},
): Promise<PhotoUploadReconciliationResult> {
  const now = options.now ?? new Date();
  const staleAfterMs = options.staleAfterMs ?? staleUploadThresholdMs();
  const cutoff = new Date(now.getTime() - staleAfterMs);
  const retryAt = new Date(now.getTime() + (options.cleanupRetryMs ?? defaultCleanupRetryMs));
  const batchSize = boundedBatchSize(options.batchSize ?? defaultBatchSize);
  const database = options.database ?? databaseAdapter();
  const storage = options.storage ?? (await LocalPrivateStorage.create(privateStorageRoot()));

  const page = await database.clientPhotoUpload.findMany({
    where: {
      status: { in: ['PENDING', 'CLEANUP_PENDING', 'RECONCILING'] },
      OR: [{ leaseExpiresAt: { lte: now } }, { leaseExpiresAt: null, createdAt: { lte: cutoff } }],
    },
    select: {
      id: true,
      uploadId: true,
      companyId: true,
      clientId: true,
      sourceStorageKey: true,
      finalStorageKey: true,
      previousPhotoPath: true,
      finalBytes: true,
      previousPhotoBytes: true,
      ledgerCommittedBytes: true,
      status: true,
      sha256: true,
      leaseExpiresAt: true,
      committedAt: true,
      createdAt: true,
    },
    orderBy: [{ leaseExpiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    take: batchSize + 1,
  });
  const hasMore = page.length > batchSize;
  const candidates = page.slice(0, batchSize);
  let reconciled = 0;
  let cleanupPending = 0;

  for (const candidate of candidates) {
    const claimed = await database.$transaction(async (transaction) => {
      const claim = await transaction.clientPhotoUpload.updateMany({
        where: {
          id: candidate.id,
          companyId: candidate.companyId,
          clientId: candidate.clientId,
          status: { in: ['PENDING', 'CLEANUP_PENDING', 'RECONCILING'] },
          OR: [
            { leaseExpiresAt: { lte: now } },
            { leaseExpiresAt: null, createdAt: { lte: cutoff } },
          ],
        },
        data: { status: 'RECONCILING', leaseExpiresAt: retryAt },
      });
      if (claim.count !== 1) return false;
      if (candidate.status === 'PENDING') {
        await transaction.auditLog.create({
          data: {
            actorUserId: null,
            actorEmailSnapshot: 'system@pilot-plus.local',
            companyId: candidate.companyId,
            action: 'SCAN',
            entityType: 'CLIENT',
            entityId: candidate.clientId,
            entityLabel: 'Фотография клиента',
            changes: {
              ...(candidate.sha256 ? { sha256: candidate.sha256 } : {}),
              verdict: 'ERROR',
              reason: 'STALE_PHOTO_LEASE',
            },
          },
          select: { id: true },
        });
      }
      return true;
    });
    if (!claimed) continue;

    const currentClient = await database.client.findFirst({
      where: {
        id: candidate.clientId,
        companyId: candidate.companyId,
      },
      select: { photoPath: true, photoBytes: true },
    });
    if (!currentClient) {
      await database.clientPhotoUpload.updateMany({
        where: { id: candidate.id, companyId: candidate.companyId, clientId: candidate.clientId },
        data: { status: 'CLEANUP_PENDING', leaseExpiresAt: retryAt },
      });
      cleanupPending += 1;
      continue;
    }

    const isCurrent = currentClient.photoPath === candidate.finalStorageKey;
    const committed = candidate.committedAt !== null || isCurrent;
    const cleanup = committed
      ? await Promise.allSettled([
          removePrivateIfPresent(storage, candidate.sourceStorageKey),
          removePrivateIfPresent(storage, candidate.previousPhotoPath),
          ...(isCurrent ? [] : [removePrivateIfPresent(storage, candidate.finalStorageKey)]),
          storage.removeUploadArtifacts(candidate.uploadId),
          storage.removeUploadArtifacts(`normalized-${candidate.uploadId}`),
        ])
      : await Promise.allSettled([
          removePrivateIfPresent(storage, candidate.sourceStorageKey),
          removePrivateIfPresent(storage, candidate.finalStorageKey),
          storage.removeUploadArtifacts(candidate.uploadId),
          storage.removeUploadArtifacts(`normalized-${candidate.uploadId}`),
        ]);
    const cleaned = cleanup.every((result) => result.status === 'fulfilled');
    if (!cleaned) cleanupPending += 1;
    if (cleaned) {
      await database.$transaction(async (transaction) => {
        const finalBytes = committed ? (candidate.finalBytes ?? currentClient.photoBytes) : 0;
        const upload = await transaction.clientPhotoUpload.updateMany({
          where: {
            id: candidate.id,
            companyId: candidate.companyId,
            clientId: candidate.clientId,
            status: 'RECONCILING',
          },
          data: {
            status: committed ? 'COMMITTED' : 'ERROR',
            leaseExpiresAt: null,
            ledgerCommittedBytes: finalBytes,
            ...(committed ? { committedAt: candidate.committedAt ?? now } : {}),
          },
        });
        if (upload.count !== 1) throw new Error('Photo cleanup ownership lost.');
        if (committed && candidate.previousPhotoPath) {
          await transaction.clientPhotoUpload.updateMany({
            where: {
              companyId: candidate.companyId,
              clientId: candidate.clientId,
              finalStorageKey: candidate.previousPhotoPath,
              ledgerCommittedBytes: { gt: 0 },
            },
            data: { ledgerCommittedBytes: 0 },
          });
        }
        const settled = await settleClientUploadPermitInTransaction(
          transaction as unknown as UploadPermitTransaction,
          {
            uploadId: candidate.uploadId,
            companyId: candidate.companyId,
            status: committed ? 'COMPLETED' : 'RELEASED',
            now,
            committedBytes: committed ? finalBytes - candidate.previousPhotoBytes : 0,
          },
        );
        if (!settled) throw new Error('Photo permit ownership lost.');
      });
    } else {
      await database.clientPhotoUpload.updateMany({
        where: {
          id: candidate.id,
          companyId: candidate.companyId,
          clientId: candidate.clientId,
          status: 'RECONCILING',
        },
        data: { status: 'CLEANUP_PENDING', leaseExpiresAt: retryAt },
      });
    }
    reconciled += 1;
  }

  return { reconciled, cleanupPending, hasMore };
}
