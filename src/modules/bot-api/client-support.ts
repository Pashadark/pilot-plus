import { prisma } from '@/database/prisma/client';
import { BotApiError } from './auth';
import type { BotIdentityContext } from './queries';
const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
export async function sendClientSupport(
  identity: BotIdentityContext,
  input: { text: string; fineId?: string; key: string },
  database: Pick<typeof prisma, '$transaction'> = prisma,
) {
  if (identity.kind !== 'CLIENT' || !identity.clientId) throw new BotApiError('FORBIDDEN', 403);
  return database.$transaction(
    async (tx) => {
      const fine = input.fineId
        ? await tx.fine.findFirst({
            where: {
              id: input.fineId,
              companyId: identity.companyId,
              clientId: identity.clientId,
              assignmentConfirmedAt: { not: null },
              assignmentConfirmedByUserId: { not: null },
            },
            select: { decreeNumber: true },
          })
        : null;
      if (input.fineId && !fine) throw new BotApiError('NOT_FOUND', 404);
      const binding = await tx.telegramGroupBinding.findUnique({
        where: { companyId: identity.companyId },
        select: { telegramChatId: true },
      });
      if (!binding) throw new BotApiError('SERVICE_UNAVAILABLE', 503);
      const prefix = `client-support:${identity.identityId}:`;
      const count = await tx.botNotificationJob.count({
        where: {
          companyId: identity.companyId,
          eventKey: { startsWith: prefix },
          createdAt: { gte: new Date(Date.now() - 300000) },
        },
      });
      if (count >= 3) throw new BotApiError('RATE_LIMITED', 429);
      await tx.botNotificationJob.createMany({
        data: [
          {
            companyId: identity.companyId,
            chatId: binding.telegramChatId,
            eventKey: prefix + input.key,
            template: 'CLIENT_SUPPORT_REQUEST',
            payload: {
              message: `💬 <b>Вопрос клиента</b>\n👤 ${escape(identity.displayName)}${fine ? `\nПостановление № ${escape(fine.decreeNumber)}` : ''}\n\n${escape(input.text)}\n\n<a href="https://supapro.ru/clients/${encodeURIComponent(identity.clientId!)}">Карточка клиента</a>`,
              parseMode: 'HTML',
            },
            availableAt: new Date(),
          },
        ],
        skipDuplicates: true,
      });
      return { ok: true };
    },
    { isolationLevel: 'Serializable' },
  );
}
