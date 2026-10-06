import type { PrismaClient } from '@/database/generated/prisma';
import { decryptField, encryptField } from '@/services/security/field-encryption';
import { reminderDue } from './dialogue-policy';
import type { AssistantState } from './assistant-store';

/** Call only after fresh authoritative chat history has been reconciled. */
export async function queueAvitoReminder(
  id: string,
  config: { companyId: string; accountId: string; encryptionKey: string },
  now: Date,
  db: Pick<PrismaClient, '$transaction'>,
) {
  return db.$transaction(
    async (tx) => {
      const row = await tx.avitoDialogue.findUnique({ where: { id } });
      if (!row || row.companyId !== config.companyId || row.accountId !== config.accountId) return;
      const state: AssistantState = JSON.parse(
        decryptField(row.contentEncrypted, config.encryptionKey),
      );
      if (!reminderDue(state.clock, now)) return;
      const binding = await tx.telegramGroupBinding.findUnique({
        where: { companyId: config.companyId },
        select: { telegramChatId: true },
      });
      if (!binding) return;
      const elapsed = Math.floor((now.getTime() - Date.parse(state.clock.waitingSince!)) / 60000);
      await tx.botNotificationJob.createMany({
        data: [
          {
            companyId: config.companyId,
            chatId: binding.telegramChatId,
            template: 'AVITO_WAITING',
            eventKey: `avito-wait:${id}:${state.clock.episode}`,
            availableAt: now,
            payload: {
              message: `Клиент Авито ждёт ответа менеджера · ${elapsed} мин.\nАвтоответ не заменяет ответ менеджера.\nЧат: https://www.avito.ru/profile/messenger/channel/${encodeURIComponent(row.chatId)}\nЗаявки: https://supapro.ru/leads`,
            },
          },
        ],
        skipDuplicates: true,
      });
      state.clock.remindedEpisode = state.clock.episode;
      await tx.avitoDialogue.update({
        where: { id },
        data: {
          reminderAt: null,
          contentEncrypted: encryptField(JSON.stringify(state), config.encryptionKey),
        },
      });
    },
    { isolationLevel: 'Serializable' },
  );
}
