import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';
import type { PrivateStorage } from '@/services/storage/private-storage';

type Count = { count: number };
type ExpiredPermit = {
  id: string;
  uploadId: string;
  companyId: string;
  status: string;
  leaseExpiresAt: Date;
};

type PermitTransaction = {
  clientUploadPermit: { updateMany(args: unknown): Promise<Count> };
  clientDocumentVersion: { count(args: unknown): Promise<number> };
  clientPhotoUpload: { count(args: unknown): Promise<number> };
};

export type PermitReconciliationDatabase = PermitTransaction & {
  clientUploadPermit: PermitTransaction['clientUploadPermit'] & {
    findMany(args: unknown): Promise<ExpiredPermit[]>;
  };
  $transaction<T>(
    operation: (transaction: PermitTransaction) => Promise<T>,
    options?: { isolationLevel: 'Serializable' },
  ): Promise<T>;
};

type PermitReconciliationStorage = Pick<PrivateStorage, 'removeUploadArtifacts'>;
type Options = {
  database?: PermitReconciliationDatabase;
  storage?: PermitReconciliationStorage;
  now?: Date;
  cleanupRetryMs?: number;
  batchSize?: number;
};

export type PermitReconciliationResult = {
  released: number;
  linked: number;
  cleanupPending: number;
  hasMore: boolean;
};

const defaultBatchSize = 100;
const maximumBatchSize = 500;
const defaultCleanupRetryMs = 5 * 60_000;

function databaseAdapter(): PermitReconciliationDatabase {
  return {
    clientUploadPermit: {
      findMany: async (args) =>
        (await prisma.clientUploadPermit.findMany(
          args as Prisma.ClientUploadPermitFindManyArgs,
        )) as ExpiredPermit[],
      updateMany: (args) =>
        prisma.clientUploadPermit.updateMany(args as Prisma.ClientUploadPermitUpdateManyArgs),
    },
    clientDocumentVersion: {
      count: (args) =>
        prisma.clientDocumentVersion.count(args as Prisma.ClientDocumentVersionCountArgs),
    },
    clientPhotoUpload: {
      count: (args) => prisma.clientPhotoUpload.count(args as Prisma.ClientPhotoUploadCountArgs),
    },
    $transaction: (operation, options) =>
      prisma.$transaction(
        (transaction) =>
          operation({
            clientUploadPermit: {
              updateMany: (args) =>
                transaction.clientUploadPermit.updateMany(
                  args as Prisma.ClientUploadPermitUpdateManyArgs,
                ),
            },
            clientDocumentVersion: {
              count: (args) =>
                transaction.clientDocumentVersion.count(
                  args as Prisma.ClientDocumentVersionCountArgs,
                ),
            },
            clientPhotoUpload: {
              count: (args) =>
                transaction.clientPhotoUpload.count(args as Prisma.ClientPhotoUploadCountArgs),
            },
          }),
        options,
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

export async function reconcileExpiredClientUploadPermits(
  options: Options = {},
): Promise<PermitReconciliationResult> {
  const now = options.now ?? new Date();
  const retryAt = new Date(now.getTime() + (options.cleanupRetryMs ?? defaultCleanupRetryMs));
  const batchSize = boundedBatchSize(options.batchSize ?? defaultBatchSize);
  const database = options.database ?? databaseAdapter();
  const storage = options.storage ?? (await LocalPrivateStorage.create(privateStorageRoot()));
  const page = await database.clientUploadPermit.findMany({
    where: { status: { in: ['ACTIVE', 'RECONCILING'] }, leaseExpiresAt: { lte: now } },
    select: { id: true, uploadId: true, companyId: true, status: true, leaseExpiresAt: true },
    orderBy: [{ leaseExpiresAt: 'asc' }, { id: 'asc' }],
    take: batchSize + 1,
  });
  const hasMore = page.length > batchSize;
  let released = 0;
  let linked = 0;
  let cleanupPending = 0;

  for (const candidate of page.slice(0, batchSize)) {
    const ownership = await database.$transaction(
      async (transaction) => {
        const [documentLinks, photoLinks] = await Promise.all([
          transaction.clientDocumentVersion.count({
            where: {
              uploadId: candidate.uploadId,
              OR: [
                { scanVerdict: null },
                { scanVerdict: 'ERROR', storageDeletedAt: null },
                { cleanupPending: true },
              ],
            },
          }),
          transaction.clientPhotoUpload.count({
            where: {
              uploadId: candidate.uploadId,
              status: { in: ['PENDING', 'CLEANUP_PENDING', 'RECONCILING'] },
            },
          }),
        ]);
        if (documentLinks > 0 || photoLinks > 0) {
          const retained = await transaction.clientUploadPermit.updateMany({
            where: {
              id: candidate.id,
              uploadId: candidate.uploadId,
              companyId: candidate.companyId,
              status: { in: ['ACTIVE', 'RECONCILING'] },
              leaseExpiresAt: { lte: now },
            },
            data: { status: 'ACTIVE', leaseExpiresAt: retryAt },
          });
          return retained.count === 1 ? 'LINKED' : 'LOST';
        }

        const claim = await transaction.clientUploadPermit.updateMany({
          where: {
            id: candidate.id,
            uploadId: candidate.uploadId,
            companyId: candidate.companyId,
            status: { in: ['ACTIVE', 'RECONCILING'] },
            leaseExpiresAt: { lte: now },
          },
          data: { status: 'RECONCILING', leaseExpiresAt: retryAt },
        });
        return claim.count === 1 ? 'ORPHAN' : 'LOST';
      },
      { isolationLevel: 'Serializable' },
    );

    if (ownership === 'LINKED') {
      linked += 1;
      continue;
    }
    if (ownership !== 'ORPHAN') continue;

    const cleaned = await storage
      .removeUploadArtifacts(candidate.uploadId)
      .then(() => true)
      .catch(() => false);
    if (!cleaned) {
      cleanupPending += 1;
      await database.clientUploadPermit.updateMany({
        where: {
          id: candidate.id,
          uploadId: candidate.uploadId,
          companyId: candidate.companyId,
          status: 'RECONCILING',
        },
        data: { status: 'RECONCILING', leaseExpiresAt: retryAt },
      });
      continue;
    }

    const result = await database.clientUploadPermit.updateMany({
      where: {
        id: candidate.id,
        uploadId: candidate.uploadId,
        companyId: candidate.companyId,
        status: 'RECONCILING',
      },
      data: { status: 'RELEASED', completedAt: now, leaseExpiresAt: now },
    });
    if (result.count === 1) released += 1;
  }

  return { released, linked, cleanupPending, hasMore };
}
