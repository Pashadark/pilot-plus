import type { Prisma } from '@/database/generated/prisma';
import { buildLeadNotificationRows, type LeadNotificationEvent } from './notification-jobs';

export async function enqueueWebsiteNotifications(
  tx: Prisma.TransactionClient,
  event: LeadNotificationEvent,
  now = new Date(),
) {
  const binding = await tx.telegramGroupBinding.findUnique({
    where: { companyId: event.companyId },
    select: { telegramChatId: true, boundByUserId: true },
  });
  if (!binding) return;
  const identity = await tx.telegramIdentity.findFirst({
    where: {
      companyId: event.companyId,
      userId: binding.boundByUserId,
      kind: 'STAFF',
      isActive: true,
      user: { is: { isActive: true } },
    },
    select: { id: true },
  });
  const rows = buildLeadNotificationRows(
    event,
    { groupChatId: binding.telegramChatId, personalIdentityId: identity?.id ?? null },
    now,
  );
  if (rows.length) await tx.botNotificationJob.createMany({ data: rows, skipDuplicates: true });
}
