import { randomUUID } from 'node:crypto';

import { prisma } from '../src/database/prisma/client';
import { clientUploadLimitsFromEnvironment } from '../src/modules/client-documents/server/upload-resource-controls';
import {
  backfillPreviewSource,
  type MissingPreviewCandidate,
} from '../src/services/media/backfill-preview';
import { LocalPrivateStorage } from '../src/services/storage/local-private-storage';

const imageMimes = ['image/jpeg', 'image/png', 'image/webp'] as const;

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('PRIVATE_STORAGE_ROOT is required');
  return root;
}

function batchSize() {
  const argument = process.argv.find((value) => value.startsWith('--batch-size='));
  const parsed = Number.parseInt(argument?.slice('--batch-size='.length) ?? '100', 10);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(500, parsed));
}

async function main() {
  const apply = process.argv.includes('--apply');
  const limit = batchSize();
  const storage = await LocalPrivateStorage.create(privateStorageRoot());
  const quota = clientUploadLimitsFromEnvironment().companyQuotaBytes;

  const clientDocuments = await backfillPreviewSource({
    source: 'CLIENT_DOCUMENT',
    profile: 'CLIENT_DOCUMENT',
    apply,
    batchSize: limit,
    storage,
    randomId: randomUUID,
    findBatch: async ({ afterId, limit: take }) => {
      const rows = await prisma.clientDocumentVersion.findMany({
        where: {
          id: afterId ? { gt: afterId } : undefined,
          scanVerdict: 'CLEAN',
          cleanupPending: false,
          storageDeletedAt: null,
          previewStorageKey: null,
          verifiedMime: { in: [...imageMimes] },
          document: { archivedAt: null },
        },
        select: {
          id: true,
          storageKey: true,
          verifiedMime: true,
          document: { select: { companyId: true } },
        },
        orderBy: { id: 'asc' },
        take,
      });
      return rows.map((row) => ({
        id: row.id,
        companyId: row.document.companyId,
        storageKey: row.storageKey,
        verifiedMime: row.verifiedMime,
      }));
    },
    commit: (candidate, preview) =>
      prisma.$transaction(async (transaction) => {
        const updated = await transaction.clientDocumentVersion.updateMany({
          where: {
            id: candidate.id,
            storageKey: candidate.storageKey,
            scanVerdict: 'CLEAN',
            cleanupPending: false,
            storageDeletedAt: null,
            previewStorageKey: null,
            document: { companyId: candidate.companyId, archivedAt: null },
          },
          data: {
            previewStorageKey: preview.storageKey,
            previewMime: preview.mime,
            previewBytes: preview.bytes,
            previewSha256: preview.sha256,
            previewGeneratedAt: preview.generatedAt,
            ledgerCommittedBytes: { increment: preview.bytes },
          },
        });
        if (updated.count !== 1) return false;
        const ledger = await transaction.clientStorageLedger.updateMany({
          where: {
            companyId: candidate.companyId,
            reconciledAt: { not: null },
            committedBytes: { lte: BigInt(quota - preview.bytes) },
          },
          data: { committedBytes: { increment: BigInt(preview.bytes) } },
        });
        if (ledger.count !== 1) throw new Error('Client storage quota unavailable.');
        return true;
      }),
  });

  const rentalOperations = await backfillPreviewSource({
    source: 'RENTAL_OPERATION',
    profile: 'RENTAL_VEHICLE_PHOTO',
    apply,
    batchSize: limit,
    storage,
    randomId: randomUUID,
    findBatch: async ({ afterId, limit: take }) => {
      const rows = await prisma.rentalOperationMedia.findMany({
        where: {
          id: afterId ? { gt: afterId } : undefined,
          status: 'CLEAN',
          previewStorageKey: null,
          verifiedMime: { in: [...imageMimes] },
        },
        select: { id: true, companyId: true, storageKey: true, verifiedMime: true },
        orderBy: { id: 'asc' },
        take,
      });
      return rows.flatMap((row): MissingPreviewCandidate[] =>
        row.verifiedMime
          ? [
              {
                id: row.id,
                companyId: row.companyId,
                storageKey: row.storageKey,
                verifiedMime: row.verifiedMime,
              },
            ]
          : [],
      );
    },
    commit: (candidate, preview) =>
      prisma.rentalOperationMedia
        .updateMany({
          where: {
            id: candidate.id,
            companyId: candidate.companyId,
            storageKey: candidate.storageKey,
            status: 'CLEAN',
            previewStorageKey: null,
          },
          data: {
            previewStorageKey: preview.storageKey,
            previewMime: preview.mime,
            previewBytes: preview.bytes,
            previewSha256: preview.sha256,
            previewGeneratedAt: preview.generatedAt,
          },
        })
        .then((updated) => updated.count === 1),
  });

  process.stdout.write(
    `${JSON.stringify({ mode: apply ? 'apply' : 'dry-run', clientDocuments, rentalOperations })}\n`,
  );
}

if (process.argv[1]?.endsWith('backfill-uploaded-media-webp-previews.ts')) {
  main()
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : 'backfill failed'}\n`);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
