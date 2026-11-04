import { randomUUID } from 'node:crypto';

import { prisma } from '../src/database/prisma/client';
import { reconcileOperationMedia } from '../src/modules/rentals/operations/media/reconcile-operation-media';
import { LocalPrivateStorage } from '../src/services/storage/local-private-storage';

async function main() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('PRIVATE_STORAGE_ROOT is required');
  const now = new Date();
  const staleMinutes = Number(process.env.RENTAL_OPERATION_MEDIA_STALE_MINUTES ?? 15);
  if (!Number.isFinite(staleMinutes) || staleMinutes < 5 || staleMinutes > 1440)
    throw new Error('RENTAL_OPERATION_MEDIA_STALE_MINUTES must be between 5 and 1440');
  const staleBefore = new Date(now.getTime() - staleMinutes * 60_000);
  const storage = await LocalPrivateStorage.create(root);
  const result = await reconcileOperationMedia({
    repository: {
      findExpired: ({ limit }) =>
        prisma.rentalOperationMedia.findMany({
          where: {
            OR: [
              { status: { in: ['PENDING', 'ERROR', 'BLOCKED'] }, createdAt: { lt: staleBefore } },
              { status: { in: ['SCANNING', 'CLEANING'] }, leaseExpiresAt: { lt: now } },
            ],
          },
          select: {
            id: true,
            uploadId: true,
            storageKey: true,
            previewStorageKey: true,
            status: true,
            claimToken: true,
            leaseExpiresAt: true,
          },
          orderBy: { createdAt: 'asc' },
          take: limit,
        }),
      updateMany: (args) => prisma.rentalOperationMedia.updateMany(args as never),
      deleteMany: (args) => prisma.rentalOperationMedia.deleteMany(args as never),
    },
    storage,
    now,
    claimToken: randomUUID,
    limit: 50,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'reconciliation failed'}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
