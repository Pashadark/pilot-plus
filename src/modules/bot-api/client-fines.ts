import { prisma } from '@/database/prisma/client';
import { BotApiError } from './auth';
import type { BotIdentityContext } from './queries';

export async function listClientFines(
  identity: BotIdentityContext,
  page = 0,
  database: Pick<typeof prisma, 'fine'> = prisma,
) {
  if (identity.kind !== 'CLIENT' || !identity.clientId) throw new BotApiError('FORBIDDEN', 403);
  if (!Number.isInteger(page) || page < 0 || page > 1000)
    throw new BotApiError('INVALID_REQUEST', 400);
  const rows = await database.fine.findMany({
    where: {
      companyId: identity.companyId,
      clientId: identity.clientId,
      assignmentConfirmedAt: { not: null },
      assignmentConfirmedByUserId: { not: null },
    },
    orderBy: [{ offenseAt: 'desc' }, { id: 'desc' }],
    skip: page * 5,
    take: 6,
    select: {
      id: true,
      decreeNumber: true,
      description: true,
      articleCode: true,
      offenseAt: true,
      address: true,
      status: true,
      currentAmountMinor: true,
      originalAmountMinor: true,
      discountExpiresAt: true,
      vehicle: { select: { make: true, modelName: true, model: true, registrationNumber: true } },
    },
  });
  return {
    items: rows
      .slice(0, 5)
      .map((row) => ({
        ...row,
        offenseAt: row.offenseAt.toISOString(),
        discountExpiresAt: row.discountExpiresAt?.toISOString() ?? null,
        currentAmountMinor: row.currentAmountMinor.toString(),
        originalAmountMinor: row.originalAmountMinor.toString(),
      })),
    hasMore: rows.length > 5,
    page,
  };
}
