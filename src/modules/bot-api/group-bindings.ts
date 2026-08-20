import { z } from 'zod';

import { prisma } from '@/database/prisma/client';

import { BotApiError } from './auth';
import type { BotIdentityContext } from './queries';

export const telegramWorkGroupSchema = z.object({
  telegramChatId: z.string().regex(/^-[1-9]\d{0,19}$/u),
  chatType: z.enum(['group', 'supergroup']),
  title: z.string().trim().min(1).max(200).optional(),
});

export type TelegramWorkGroupInput = z.infer<typeof telegramWorkGroupSchema>;

export async function bindTelegramWorkGroup(
  identity: BotIdentityContext,
  rawInput: TelegramWorkGroupInput,
  database: Pick<typeof prisma, '$transaction'> = prisma,
) {
  if (identity.kind !== 'STAFF' || !identity.userId) throw new BotApiError('FORBIDDEN', 403);
  const userId = identity.userId;
  const parsed = telegramWorkGroupSchema.safeParse(rawInput);
  if (!parsed.success) throw new BotApiError('INVALID_REQUEST', 400);

  return database.$transaction(
    async (tx) => {
      const current = await tx.telegramIdentity.findFirst({
        where: {
          id: identity.identityId,
          companyId: identity.companyId,
          telegramUserId: identity.telegramUserId,
          userId,
          kind: 'STAFF',
          isActive: true,
          user: { is: { isActive: true } },
        },
        select: { user: { select: { role: true } } },
      });
      if (!current) throw new BotApiError('FORBIDDEN', 403);
      const member = await tx.companyMember.findFirst({
        where: { companyId: identity.companyId, userId },
        select: { role: true },
      });
      if (
        current.user?.role !== 'SUPER_ADMIN' &&
        !['COMPANY_ADMIN', 'DISPATCHER'].includes(member?.role ?? '')
      ) {
        throw new BotApiError('FORBIDDEN', 403);
      }
      const occupied = await tx.telegramGroupBinding.findUnique({
        where: { telegramChatId: parsed.data.telegramChatId },
        select: { companyId: true },
      });
      if (occupied && occupied.companyId !== identity.companyId)
        throw new BotApiError('IDENTITY_CONFLICT', 409);
      const binding = await tx.telegramGroupBinding.upsert({
        where: { companyId: identity.companyId },
        create: {
          companyId: identity.companyId,
          boundByUserId: userId,
          telegramChatId: parsed.data.telegramChatId,
          title: parsed.data.title,
        },
        update: {
          telegramChatId: parsed.data.telegramChatId,
          title: parsed.data.title,
          boundByUserId: userId,
        },
        select: { companyId: true, telegramChatId: true, title: true },
      });
      await tx.auditLog.create({
        data: {
          companyId: identity.companyId,
          actorUserId: userId,
          actorEmailSnapshot: 'redacted@audit.invalid',
          action: 'ASSIGN',
          entityType: 'SYSTEM',
          entityLabel: 'TELEGRAM_GROUP_BINDING',
          changes: { chatType: parsed.data.chatType },
        },
      });
      return binding;
    },
    { isolationLevel: 'Serializable' },
  );
}
