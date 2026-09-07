import { prisma } from '@/database/prisma/client';
import { syncCompanyFines } from '@/modules/fines/sync/sync-company-fines.server';

const FINE_SYNC_INTERVAL_MS = 3 * 60 * 60_000;

export async function syncDueCompanyFines(
  now: Date,
  database = prisma,
  sync: (companyId: string) => Promise<unknown> = syncCompanyFines,
) {
  if (now.getUTCSeconds() >= 10) return 0;
  const dueBefore = new Date(now.getTime() - FINE_SYNC_INTERVAL_MS);
  const due = await database.fineIntegration.findMany({
    where: {
      enabled: true,
      OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: dueBefore } }],
    },
    select: { companyId: true },
    orderBy: [{ lastAttemptAt: 'asc' }, { companyId: 'asc' }],
    take: 20,
  });
  const claimed: string[] = [];
  for (const integration of due) {
    const result = await database.fineIntegration.updateMany({
      where: {
        companyId: integration.companyId,
        enabled: true,
        OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: dueBefore } }],
      },
      data: { lastAttemptAt: now },
    });
    if (result.count === 1) claimed.push(integration.companyId);
  }
  await Promise.allSettled(claimed.map((companyId) => sync(companyId)));
  return claimed.length;
}
