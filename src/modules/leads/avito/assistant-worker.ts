import type { PrismaClient } from '@/database/generated/prisma';
import { decryptField, encryptField } from '@/services/security/field-encryption';
import { AvitoClient } from './client';
import { activeRentalIds, readHumanReplies } from './assistant-runtime';
import { saveAssistantEvent, type AssistantConfig, type AssistantState } from './assistant-store';
import { eligibleRentalAd, rentalQuestions } from './rental-request';
import { avitoId, record } from './message';
import { customerReply } from './customer-reply';
import { queueAvitoReminder } from './reminder';
import { sendReservedQuestion } from './delivery';
import { readAvitoControl } from './control';

export function loadRentalFleet(db: PrismaClient, companyId: string) {
  return db.vehicle.findMany({
    where: { companyId, archivedAt: null, isDemoImport: false },
    select: {
      id: true,
      model: true,
      registrationNumber: true,
      isRentalReady: true,
      status: true,
      rentals: {
        where: { companyId, status: { in: ['ACTIVE', 'CONFIRMED'] } },
        select: { status: true, startsAt: true, endsAt: true },
      },
      maintenanceRecords: {
        where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        select: { status: true, scheduledAt: true, scheduledEndsAt: true },
      },
    },
  });
}

export async function prepareAssistantInput(
  input: { chatId: string; chat: unknown; message: unknown },
  config: AssistantConfig,
  api: AvitoClient,
  db: PrismaClient,
) {
  const eligible = eligibleRentalAd(
    input.chat,
    config.accountId,
    activeRentalIds(await api.activeItems()),
  );
  const leadId = avitoId(config.companyId, config.accountId, input.chatId);
  const state = await saveAssistantEvent({ ...input, leadId, eligible }, config, db);
  if (!state) return { rentalAllowed: eligible };
  let matchingSummary: string | undefined;
  if (state.request.startDay || state.request.startsAt) {
    matchingSummary =
      'Предварительный ответ по автопарку:\n' +
      customerReply(await loadRentalFleet(db, config.companyId), state.request, new Date());
  }
  return {
    rentalAllowed: eligible,
    rentalRequest: state.request,
    matchingSummary,
    conversationText: state.messages.map((m) => `${m.at}: ${m.text}`).join('\n'),
  };
}

async function refreshHumanReplies(
  chatId: string,
  leadId: string,
  config: AssistantConfig,
  api: AvitoClient,
  db: PrismaClient,
) {
  const chat = record(await api.chat(config.accountId, chatId));
  if (
    chat.id !== chatId ||
    !Array.isArray(chat.users) ||
    !chat.users.some((u) => String(record(u).id) === config.accountId)
  )
    throw Error('AVITO_CHAT');
  const outgoing = await db.avitoOutgoing.findMany({
    where: { companyId: config.companyId, accountId: config.accountId, chatId },
    select: { state: true, providerId: true },
  });
  if (outgoing.some((o) => ['SENDING', 'UNKNOWN'].includes(o.state))) return false;
  const ownIds = new Set(outgoing.flatMap((o) => (o.providerId ? [o.providerId] : [])));
  const dialogue = await db.avitoDialogue.findUnique({
    where: { id: avitoId(config.companyId, config.accountId, chatId) },
  });
  const resumeAt = dialogue
    ? Date.parse(
        (
          JSON.parse(
            decryptField(dialogue.contentEncrypted, config.encryptionKey),
          ) as AssistantState
        ).automationResumedAt ?? '',
      )
    : NaN;
  const since = Number.isFinite(resumeAt)
    ? new Date(Math.max(config.enabledAt.getTime(), resumeAt))
    : config.enabledAt;
  const replies = await readHumanReplies(api, config.accountId, chatId, since, ownIds);
  for (const message of replies)
    await saveAssistantEvent({ chatId, leadId, eligible: true, message }, config, db);
  return true;
}

export async function tickAssistant(
  config: AssistantConfig,
  api: AvitoClient,
  db: PrismaClient,
  sendEnabled: boolean,
  now = new Date(),
) {
  const due = await db.avitoDialogue.findMany({
    where: { companyId: config.companyId, accountId: config.accountId, reminderAt: { lte: now } },
    take: 5,
    orderBy: { reminderAt: 'asc' },
  });
  for (const row of due) {
    if (await refreshHumanReplies(row.chatId, row.leadId, config, api, db))
      await queueAvitoReminder(row.id, config, now, db);
  }
  if (!sendEnabled) return;
  const control = await readAvitoControl(config.companyId, db);
  if (!control.enabled || !control.enabledAt) return;
  config = {
    ...config,
    sendEnabledAt: new Date(
      Math.max(Date.parse(control.enabledAt), config.sendEnabledAt?.getTime() || 0),
    ),
  };
  const job = await db.avitoOutgoing.findFirst({
    where: { companyId: config.companyId, accountId: config.accountId, state: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });
  if (!job) return;
  const dialogueId = avitoId(config.companyId, config.accountId, job.chatId);
  const cancel = () =>
    db.avitoOutgoing.updateMany({
      where: { id: job.id, state: 'PENDING' },
      data: { state: 'CANCELLED' },
    });
  if (
    now.getTime() - job.createdAt.getTime() > 10 * 60000 ||
    (config.sendEnabledAt && job.createdAt < config.sendEnabledAt)
  ) {
    await cancel();
    return;
  }
  if (
    await db.avitoInboxEvent.count({
      where: {
        companyId: config.companyId,
        accountId: config.accountId,
        chatId: job.chatId,
        state: 'PENDING',
      },
    })
  )
    return;
  const row = await db.avitoDialogue.findUnique({ where: { id: dialogueId } });
  if (
    !row ||
    (await db.avitoOutgoing.findFirst({
      where: {
        companyId: config.companyId,
        accountId: config.accountId,
        chatId: job.chatId,
        state: { in: ['SENT', 'SENDING', 'UNKNOWN'] },
      },
      select: { id: true },
    }))
  ) {
    await cancel();
    return;
  }
  if (!(await refreshHumanReplies(job.chatId, row.leadId, config, api, db))) return;
  const refreshed = await db.avitoDialogue.findUnique({ where: { id: dialogueId } });
  if (!refreshed) return;
  const state: AssistantState = JSON.parse(
    decryptField(refreshed.contentEncrypted, config.encryptionKey),
  );
  if (
    state.clock.paused ||
    state.handedOffAt ||
    (refreshed.createdAt && refreshed.createdAt < config.sendEnabledAt!) ||
    state.messages.some((message) => Date.parse(message.at) < config.sendEnabledAt!.getTime()) ||
    !rentalQuestions(state.request) ||
    state.messages.at(-1)?.id !== job.incomingId ||
    !state.clock.lastCustomerAt ||
    (config.sendEnabledAt &&
      Date.parse(state.clock.lastCustomerAt) < config.sendEnabledAt.getTime()) ||
    now.getTime() - Date.parse(state.clock.lastCustomerAt) > 10 * 60000
  ) {
    await cancel();
    return;
  }
  const ids = activeRentalIds(await api.activeItems());
  const chat = await api.chat(config.accountId, job.chatId);
  if (!eligibleRentalAd(chat, config.accountId, ids)) {
    await cancel();
    return;
  }
  const text = customerReply(await loadRentalFleet(db, config.companyId), state.request, now);
  const latest = await readAvitoControl(config.companyId, db);
  if (!latest.enabled || latest.updatedAt !== control.updatedAt) {
    await cancel();
    return;
  }
  await sendReservedQuestion({
    reserve: async () =>
      (
        await db.avitoOutgoing.updateMany({
          where: { id: job.id, state: 'PENDING' },
          data: {
            state: 'SENDING',
            attemptedAt: new Date(),
            textEncrypted: encryptField(text, config.encryptionKey),
          },
        })
      ).count === 1,
    send: async () => {
      const current = await readAvitoControl(config.companyId, db);
      if (!current.enabled || current.updatedAt !== control.updatedAt)
        throw Error('AVITO_DISABLED');
      return api.sendText(config.accountId, job.chatId, text);
    },
    finish: (state, providerId) =>
      db.avitoOutgoing.update({
        where: { id: job.id },
        data: {
          state,
          providerId,
          sentAt: state === 'SENT' ? new Date() : null,
          errorCode: state === 'UNKNOWN' ? 'VERIFY_BEFORE_RETRY' : null,
        },
      }),
  });
}
