import type { PrismaClient } from '@/database/generated/prisma';
import { blindIndex, decryptField, encryptField } from '@/services/security/field-encryption';
import { enqueueWebsiteNotifications } from '../enqueue-website-notifications';
import { avitoId, incomingMessage, summarizeRequest } from './message';
import { extractRentalRequest, rentalQuestions, type RentalRequest } from './rental-request';

export type AvitoConfiguration = {
  companyId: string;
  userId: string;
  accountId: string;
  enabledAt: Date;
  encryptionKey: string;
  searchKey: string;
};
export async function receiveAvitoMessage(
  input: {
    eventId: string;
    chatId: string;
    message: unknown;
    name: string;
    title: string;
    chatVerified: boolean;
    rentalAllowed?: boolean;
    rentalRequest?: RentalRequest;
    matchingSummary?: string;
    conversationText?: string;
  },
  config: AvitoConfiguration,
  db: Pick<PrismaClient, '$transaction'>,
) {
  if (
    !input.chatVerified ||
    !config.companyId ||
    !config.userId ||
    !config.accountId ||
    !Number.isFinite(config.enabledAt.getTime())
  )
    throw Error('AVITO_CONFIGURATION');
  const message = incomingMessage(input.message, config.accountId, config.enabledAt);
  return db.$transaction(
    async (tx) => {
      const event = await tx.avitoInboxEvent.findUnique({ where: { id: input.eventId } });
      if (!event || event.state !== 'PENDING') return { duplicate: true };
      if (
        event.companyId !== config.companyId ||
        event.accountId !== config.accountId ||
        event.chatId !== input.chatId ||
        (message && event.messageId !== message.id)
      )
        throw Error('AVITO_SCOPE');
      if (!message || input.rentalAllowed === false) {
        await tx.avitoInboxEvent.update({ where: { id: event.id }, data: { state: 'IGNORED' } });
        return { ignored: true };
      }
      const operator = await tx.user.findFirst({
        where: {
          id: config.userId,
          isActive: true,
          memberships: {
            some: { companyId: config.companyId, role: { in: ['COMPANY_ADMIN', 'DISPATCHER'] } },
          },
        },
        select: { id: true, email: true },
      });
      if (!operator) throw Error('AVITO_CONFIGURATION');
      const id = avitoId(config.companyId, config.accountId, input.chatId);
      const existing = await tx.lead.findUnique({
        where: { id },
        select: { id: true, companyId: true, commentEncrypted: true, phoneEncrypted: true },
      });
      if (existing && existing.companyId !== config.companyId) throw Error('AVITO_SCOPE');
      const summary = summarizeRequest(message.text);
      const request = input.rentalRequest ?? extractRentalRequest(message.text, message.createdAt);
      const questions = rentalQuestions(request);
      if (!existing && input.rentalRequest && questions) {
        await tx.avitoInboxEvent.update({
          where: { id: event.id },
          data: { state: 'DONE', errorCode: null },
        });
        return { collecting: true };
      }
      const received = new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Europe/Moscow',
      }).format(message.createdAt);
      const requestSummary = [
        `Автомобиль: ${request.model ?? 'нужно уточнить'}`,
        `Получение: ${request.startsAt ?? request.startDay ?? 'нужно уточнить'}`,
        `Возврат: ${request.endsAt ?? request.endDay ?? 'нужно уточнить'}`,
        `Общий планируемый пробег: ${request.mileageKm ? request.mileageKm + ' км' : 'нужно уточнить'}`,
        ...(questions
          ? [`Уточнить у клиента: ${questions}`]
          : ['Данные для заявки собраны; проверить менеджеру.']),
        ...(input.matchingSummary ? [input.matchingSummary] : []),
      ];
      const fragment = `\n\nАвито · ${received} (Москва)\n${summary.lines.join('\n')}\n${requestSummary.join('\n')}\nИсходное сообщение:\n${message.text}`;
      if (existing) {
        const original = existing.commentEncrypted
          ? decryptField(existing.commentEncrypted, config.encryptionKey)
          : '';
        if (original.length + fragment.length > 500000) throw Error('AVITO_HISTORY_LIMIT');
        await tx.lead.update({
          where: { id },
          data: {
            commentEncrypted: encryptField(original + fragment, config.encryptionKey),
            ...(request.phone &&
            typeof existing.phoneEncrypted === 'string' &&
            !decryptField(existing.phoneEncrypted, config.encryptionKey)
              ? {
                  phoneEncrypted: encryptField(request.phone, config.encryptionKey),
                  phoneIndex: blindIndex(request.phone, config.searchKey, (s) => s),
                }
              : {}),
          },
        });
      } else {
        const comment = `Объявление: ${input.title.slice(0, 300) || 'Не указано'}\nЧат: https://www.avito.ru/profile/messenger/channel/${encodeURIComponent(input.chatId)}\nТелефон не подтверждён. Обращение не является бронью.${fragment}${input.conversationText ? '\nПереписка клиента:\n' + input.conversationText.slice(0, 200000) : ''}`;
        await tx.lead.create({
          data: {
            id,
            companyId: config.companyId,
            name: input.name.trim().slice(0, 150) || 'Клиент Авито',
            phoneEncrypted: encryptField(request.phone || summary.phone, config.encryptionKey),
            phoneIndex: blindIndex(
              request.phone || summary.phone || id,
              config.searchKey,
              (s) => s,
            ),
            source: 'Авито',
            commentEncrypted: encryptField(comment, config.encryptionKey),
            status: 'NEW',
            createdByUserId: operator.id,
            assignedToUserId: operator.id,
          },
        });
      }
      const audit = await tx.auditLog.create({
        data: {
          companyId: config.companyId,
          actorUserId: operator.id,
          actorEmailSnapshot: operator.email,
          action: existing ? 'UPDATE' : 'CREATE',
          entityType: 'SYSTEM',
          entityId: id,
          entityLabel: 'LEAD',
          changes: { source: 'Авито', eventId: event.id, phoneVerified: false },
        },
      });
      if (!existing)
        await enqueueWebsiteNotifications(tx, {
          companyId: config.companyId,
          leadId: id,
          auditId: audit.id,
          template: 'LEAD_CREATED',
        });
      if (existing && input.rentalRequest && !questions) {
        const binding = await tx.telegramGroupBinding.findUnique({
          where: { companyId: config.companyId },
          select: { telegramChatId: true },
        });
        if (binding)
          await tx.botNotificationJob.createMany({
            data: [
              {
                companyId: config.companyId,
                chatId: binding.telegramChatId,
                template: 'AVITO_READY',
                eventKey: `avito-ready:${id}`,
                availableAt: new Date(),
                payload: {
                  message: `Заявка Авито: данные собраны. Дальше отвечает менеджер.\nhttps://supapro.ru/leads\nЧат: https://www.avito.ru/profile/messenger/channel/${encodeURIComponent(input.chatId)}`,
                },
              },
            ],
            skipDuplicates: true,
          });
      }
      await tx.avitoInboxEvent.update({
        where: { id: event.id },
        data: { state: 'DONE', leadId: id, errorCode: null },
      });
      return { id, created: !existing };
    },
    { isolationLevel: 'Serializable' },
  );
}
