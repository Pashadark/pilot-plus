import 'server-only';

import { randomUUID } from 'node:crypto';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

type StaleGeneration = {
  id: string;
  companyId: string;
  rentalId: string;
  status: 'PENDING' | 'PROMOTED' | 'CLEANING';
  claimToken: string | null;
  retryCount: number;
  docxQuarantineKey: string;
  pdfQuarantineKey: string;
  docxStorageKey: string;
  pdfStorageKey: string;
};

type Count = { count: number };

export type RentalDocumentGenerationReconciliationDatabase = {
  rentalDocumentGeneration: {
    findMany(args: unknown): Promise<StaleGeneration[]>;
    updateMany(args: unknown): Promise<Count>;
  };
};

type RentalDocumentGenerationStorage = {
  removeUploadArtifacts(uploadId: string): Promise<number>;
  removePrivate(storageKey: string): Promise<void>;
};

type Options = {
  database?: RentalDocumentGenerationReconciliationDatabase;
  storage?: RentalDocumentGenerationStorage;
  now?: Date;
  batchSize?: number;
  retryDelayMs?: number;
  maxRetries?: number;
};

export type RentalDocumentGenerationReconciliationResult = {
  reconciled: number;
  retryPending: number;
};

const defaultBatchSize = 100;
const defaultRetryDelayMs = 5 * 60_000;
const defaultMaxRetries = 3;

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('Приватное хранилище не настроено.');
  return root;
}

function isMissingStorageError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

async function removePrivateIfPresent(storage: RentalDocumentGenerationStorage, key: string) {
  try {
    await storage.removePrivate(key);
  } catch (error) {
    if (!isMissingStorageError(error)) throw error;
  }
}

function defaultDatabase(): RentalDocumentGenerationReconciliationDatabase {
  return {
    rentalDocumentGeneration: {
      findMany: (args) =>
        prisma.rentalDocumentGeneration.findMany(
          args as Prisma.RentalDocumentGenerationFindManyArgs,
        ) as Promise<StaleGeneration[]>,
      updateMany: (args) =>
        prisma.rentalDocumentGeneration.updateMany(
          args as Prisma.RentalDocumentGenerationUpdateManyArgs,
        ),
    },
  };
}

/** Reclaims only lease-expired uncommitted artifacts; a committed pair is never touched. */
export async function reconcileStaleRentalDocumentGenerations(
  options: Options = {},
): Promise<RentalDocumentGenerationReconciliationResult> {
  const now = options.now ?? new Date();
  const batchSize = Math.min(Math.max(options.batchSize ?? defaultBatchSize, 1), 500);
  const maxRetries = Math.min(Math.max(options.maxRetries ?? defaultMaxRetries, 1), 10);
  const retryDelayMs = Math.min(
    Math.max(options.retryDelayMs ?? defaultRetryDelayMs, 1_000),
    60 * 60_000,
  );
  const database = options.database ?? defaultDatabase();
  const storage = options.storage ?? (await LocalPrivateStorage.create(privateStorageRoot()));
  const candidates = await database.rentalDocumentGeneration.findMany({
    where: {
      status: { in: ['PENDING', 'PROMOTED', 'CLEANING'] },
      leaseExpiresAt: { lt: now },
      claimToken: null,
    },
    orderBy: { leaseExpiresAt: 'asc' },
    take: batchSize,
    select: {
      id: true,
      companyId: true,
      rentalId: true,
      status: true,
      claimToken: true,
      retryCount: true,
      docxQuarantineKey: true,
      pdfQuarantineKey: true,
      docxStorageKey: true,
      pdfStorageKey: true,
    },
  });
  let reconciled = 0;
  let retryPending = 0;
  for (const candidate of candidates) {
    const claimToken = randomUUID();
    const claimed = await database.rentalDocumentGeneration.updateMany({
      where: {
        id: candidate.id,
        companyId: candidate.companyId,
        rentalId: candidate.rentalId,
        status: candidate.status,
        claimToken: null,
        leaseExpiresAt: { lt: now },
      },
      data: {
        status: 'CLEANING',
        claimToken,
        leaseExpiresAt: new Date(now.getTime() + retryDelayMs),
      },
    });
    if (claimed.count !== 1) continue;
    try {
      await storage.removeUploadArtifacts(candidate.docxQuarantineKey);
      await storage.removeUploadArtifacts(candidate.pdfQuarantineKey);
      await removePrivateIfPresent(storage, candidate.docxStorageKey);
      await removePrivateIfPresent(storage, candidate.pdfStorageKey);
      const updated = await database.rentalDocumentGeneration.updateMany({
        where: {
          id: candidate.id,
          companyId: candidate.companyId,
          rentalId: candidate.rentalId,
          status: 'CLEANING',
          claimToken,
        },
        data: {
          status: 'ERROR',
          claimToken: null,
          leaseExpiresAt: null,
          lastErrorCode: 'STALE_CLEANED',
        },
      });
      if (updated.count === 1) reconciled += 1;
    } catch {
      const exhausted = candidate.retryCount + 1 >= maxRetries;
      const updated = await database.rentalDocumentGeneration.updateMany({
        where: {
          id: candidate.id,
          companyId: candidate.companyId,
          rentalId: candidate.rentalId,
          status: 'CLEANING',
          claimToken,
        },
        data: {
          status: exhausted ? 'ERROR' : 'CLEANING',
          claimToken: null,
          retryCount: { increment: 1 },
          leaseExpiresAt: exhausted ? null : new Date(now.getTime() + retryDelayMs),
          lastErrorCode: exhausted ? 'STALE_CLEANUP_EXHAUSTED' : 'STALE_CLEANUP_RETRY',
        },
      });
      if (!exhausted && updated.count === 1) retryPending += 1;
    }
  }
  return { reconciled, retryPending };
}
