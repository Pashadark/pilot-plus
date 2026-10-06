import type { PrismaClient } from '@/database/generated/prisma';
import { decryptField, encryptField } from '@/services/security/field-encryption';
import { avitoId, record } from './message';
import { advanceDialogue, emptyDialogue, type DialogueClock } from './dialogue-policy';
import {
  extractRentalRequest,
  extractRentalConversation,
  rentalQuestions,
  type RentalRequest,
} from './rental-request';

export type AssistantConfig = {
  companyId: string;
  accountId: string;
  encryptionKey: string;
  enabledAt: Date;
  sendEnabledAt?: Date;
};
export type AssistantState = {
  handedOffAt?: string;
  automationResumedAt?: string;
  clock: DialogueClock;
  request: RentalRequest;
  messages: { id: string; at: string; text: string }[];
  lastQuestion: string;
};

export async function saveAssistantEvent(
  input: { chatId: string; leadId: string; eligible: boolean; message: unknown },
  config: AssistantConfig,
  db: Pick<PrismaClient, '$transaction'>,
) {
  const m = record(input.message);
  if (
    !input.eligible ||
    typeof m.id !== 'string' ||
    typeof m.created !== 'number' ||
    !Number.isFinite(m.created) ||
    !Number.isFinite(config.enabledAt.getTime()) ||
    m.created * 1000 < config.enabledAt.getTime() ||
    m.type === 'system'
  )
    return;
  const at = new Date(m.created * 1000).toISOString();
  const messageId = m.id;
  const isHuman = m.direction === 'out' && String(m.author_id) === config.accountId;
  const isCustomer = m.direction === 'in' && String(m.author_id) !== config.accountId;
  if (!isHuman && !isCustomer) return;
  const id = avitoId(config.companyId, config.accountId, input.chatId);
  return db.$transaction(
    async (tx) => {
      const stored = await tx.avitoDialogue.findUnique({ where: { id } });
      if (
        stored &&
        (stored.companyId !== config.companyId || stored.accountId !== config.accountId)
      )
        throw Error('AVITO_SCOPE');
      const state: AssistantState = stored
        ? JSON.parse(decryptField(stored.contentEncrypted, config.encryptionKey))
        : {
            clock: emptyDialogue(),
            request: extractRentalRequest('', new Date(at)),
            messages: [],
            lastQuestion: '',
          };
      const ownOutgoing = isHuman
        ? await tx.avitoOutgoing.findFirst({
            where: {
              companyId: config.companyId,
              accountId: config.accountId,
              chatId: input.chatId,
              providerId: messageId,
            },
          })
        : null;
      if (
        isHuman &&
        state.automationResumedAt &&
        Date.parse(at) < Date.parse(state.automationResumedAt)
      )
        return state;
      const uncertain =
        isHuman && !ownOutgoing
          ? await tx.avitoOutgoing.findFirst({
              where: {
                companyId: config.companyId,
                accountId: config.accountId,
                chatId: input.chatId,
                state: { in: ['SENDING', 'UNKNOWN'] },
              },
            })
          : null;
      if (uncertain) state.clock.paused = true;
      else
        state.clock = advanceDialogue(state.clock, {
          kind: isCustomer ? 'customer' : ownOutgoing ? 'assistant' : 'human',
          at,
          id: messageId,
        });
      const newCustomerMessage =
        isCustomer && !state.messages.some((entry) => entry.id === messageId);
      if (newCustomerMessage) {
        const text = record(m.content).text;
        if (typeof text === 'string')
          state.messages.push({ id: messageId, at, text: text.slice(0, 16000) });
        // Bounded history. Exhaustion pauses automation; it never drops facts silently.
        if (
          state.messages.length > 100 ||
          state.messages.reduce((n, entry) => n + entry.text.length, 0) > 200000
        )
          state.clock.paused = true;
        state.messages.sort((a, b) => a.at.localeCompare(b.at));
        state.request = extractRentalConversation(state.messages);
      }
      const question = rentalQuestions(state.request);
      if (!question) state.handedOffAt ??= at;
      const priorReply = newCustomerMessage
        ? await tx.avitoOutgoing.findFirst({
            where: {
              companyId: config.companyId,
              accountId: config.accountId,
              chatId: input.chatId,
              state: { in: ['SENT', 'SENDING', 'UNKNOWN'] },
            },
            select: { id: true },
          })
        : null;
      if (
        newCustomerMessage &&
        question &&
        !state.handedOffAt &&
        !priorReply &&
        !state.clock.paused &&
        state.clock.waitingSince
      ) {
        await tx.avitoOutgoing.createMany({
          data: [
            {
              id: avitoId(config.companyId, config.accountId, input.chatId, messageId),
              companyId: config.companyId,
              accountId: config.accountId,
              chatId: input.chatId,
              incomingId: messageId,
              state: 'PENDING',
              textEncrypted: encryptField(question, config.encryptionKey),
            },
          ],
          skipDuplicates: true,
        });
        state.lastQuestion = question;
      }
      const reminderAt =
        state.clock.waitingSince && state.clock.episode !== state.clock.remindedEpisode
          ? new Date(Date.parse(state.clock.waitingSince) + 900000)
          : null;
      const data = {
        contentEncrypted: encryptField(JSON.stringify(state), config.encryptionKey),
        reminderAt,
      };
      await tx.avitoDialogue.upsert({
        where: { id },
        create: {
          id,
          companyId: config.companyId,
          accountId: config.accountId,
          chatId: input.chatId,
          leadId: input.leadId,
          ...data,
        },
        update: data,
      });
      return state;
    },
    { isolationLevel: 'Serializable' },
  );
}
