import { prisma } from '@/database/prisma/client';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

export async function reconcileClientStorageLedgers(options?: { batchSize?: number; now?: Date }) {
  const now = options?.now ?? new Date();
  const batchSize = Math.min(500, Math.max(1, Math.trunc(options?.batchSize ?? 100)));
  const ledgers = await prisma.clientStorageLedger.findMany({
    where: { reconciledAt: null },
    orderBy: { companyId: 'asc' },
    take: batchSize + 1,
    select: { companyId: true },
  });
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('Приватное хранилище не настроено.');
  const storage = await LocalPrivateStorage.create(root);
  let reconciled = 0;
  for (const ledger of ledgers.slice(0, batchSize)) {
    const committedBytes = await storage.privateUsageBytes(`companies/${ledger.companyId}`);
    const updated = await prisma.clientStorageLedger.updateMany({
      where: { companyId: ledger.companyId, reconciledAt: null },
      data: { committedBytes: BigInt(committedBytes), reconciledAt: now },
    });
    reconciled += updated.count;
  }
  return { reconciled, hasMore: ledgers.length > batchSize };
}
