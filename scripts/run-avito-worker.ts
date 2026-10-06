import { setTimeout as delay } from 'node:timers/promises';
import { prisma } from '../src/database/prisma/client';
import { AvitoClient, AvitoError } from '../src/modules/leads/avito/client';
import { receiveAvitoMessage } from '../src/modules/leads/avito/intake';
import { verifyAvitoEvent } from '../src/modules/leads/avito/verify';
import { prepareAssistantInput, tickAssistant } from '../src/modules/leads/avito/assistant-worker';
import { readAvitoControl } from '../src/modules/leads/avito/control';

const config = {
  companyId: process.env.AVITO_COMPANY_ID || '',
  userId: process.env.AVITO_USER_ID || '',
  accountId: process.env.AVITO_ACCOUNT_ID || '',
  enabledAt: new Date(process.env.AVITO_ENABLED_AT || ''),
  encryptionKey: process.env.CLIENT_DATA_ENCRYPTION_KEY || '',
  searchKey: process.env.CLIENT_SEARCH_KEY || '',
};
let stopping = false;
process.once('SIGTERM', () => {
  stopping = true;
});
process.once('SIGINT', () => {
  stopping = true;
});
async function main() {
  if (
    !config.companyId ||
    !config.userId ||
    !config.accountId ||
    !config.encryptionKey ||
    !config.searchKey ||
    !Number.isFinite(config.enabledAt.getTime()) ||
    !process.env.AVITO_CLIENT_ID ||
    !process.env.AVITO_CLIENT_SECRET
  )
    throw Error('AVITO_CONFIGURATION');
  // This dedicated systemd service is the sole worker; serializable intake protects retries.
  const limitedFetch: typeof fetch = async (...args) => {
    await delay(1000);
    return fetch(...args);
  };
  const api = new AvitoClient(
    process.env.AVITO_CLIENT_ID,
    process.env.AVITO_CLIENT_SECRET,
    limitedFetch,
  );
  const assistantAt = new Date(process.env.AVITO_ASSISTANT_ENABLED_AT || '');
  const sendEnabledAt = new Date(process.env.AVITO_SEND_ENABLED_AT || '');
  const assistant = Number.isFinite(assistantAt.getTime())
    ? { ...config, enabledAt: assistantAt, sendEnabledAt }
    : null;
  let lastAssistantTick = 0;
  if (assistant)
    await prisma.avitoOutgoing.updateMany({
      where: { companyId: config.companyId, accountId: config.accountId, state: 'SENDING' },
      data: { state: 'UNKNOWN', errorCode: 'INTERRUPTED_VERIFY_BEFORE_RETRY' },
    });
  console.log('AVITO_WORKER_STARTED');
  while (!stopping) {
    if (assistant && Date.now() - lastAssistantTick >= 5000) {
      lastAssistantTick = Date.now();
      try {
        await tickAssistant(
          assistant,
          api,
          prisma,
          process.env.AVITO_SEND_ENABLED === 'true' && Number.isFinite(sendEnabledAt.getTime()),
        );
      } catch (error) {
        if (error instanceof AvitoError && error.code === 'ACCESS') throw error;
        if (error instanceof AvitoError && error.code === 'RATE') lastAssistantTick = error.retryAt;
        console.error('AVITO_ASSISTANT_CHECK_DEFERRED');
      }
    }
    const event = await prisma.avitoInboxEvent.findFirst({
      where: {
        companyId: config.companyId,
        accountId: config.accountId,
        state: 'PENDING',
        nextAttempt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!event) {
      await delay(2000);
      continue;
    }
    try {
      const verified = await verifyAvitoEvent(api, event, config.accountId);
      const assistantInput = assistant
        ? await prepareAssistantInput({ ...verified, chatId: event.chatId }, assistant, api, prisma)
        : {};
      const control = await readAvitoControl(config.companyId, prisma);
      const result = await receiveAvitoMessage(
        {
          ...verified,
          ...assistantInput,
          ...(!control.enabled ? { rentalRequest: undefined } : {}),
          eventId: event.id,
          chatId: event.chatId,
        },
        config,
        prisma,
      );
      console.log(
        'AVITO_EVENT_PROCESSED',
        event.id,
        'created' in result && result.created ? 'CREATED' : 'UPDATED_OR_IGNORED',
      );
    } catch (error) {
      if (error instanceof AvitoError && error.code === 'ACCESS') {
        console.error('AVITO_ACCESS_STOP');
        process.exitCode = 78;
        return;
      }
      const attempts = event.attempts + 1;
      const rate = error instanceof AvitoError && error.code === 'RATE';
      const nextAttempt = new Date(
        rate ? error.retryAt : Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(attempts, 7)),
      );
      const errorCode =
        error instanceof AvitoError
          ? error.code
          : error instanceof Error && /^AVITO_[A-Z_]+$/.test(error.message)
            ? error.message
            : 'PROCESSING';
      await prisma.avitoInboxEvent.update({
        where: { id: event.id },
        data: {
          attempts: rate ? event.attempts : attempts,
          nextAttempt,
          state: !rate && attempts >= 10 ? 'FAILED' : 'PENDING',
          errorCode,
        },
      });
      if (rate)
        await prisma.avitoInboxEvent.updateMany({
          where: {
            companyId: config.companyId,
            accountId: config.accountId,
            state: 'PENDING',
            nextAttempt: { lt: nextAttempt },
          },
          data: { nextAttempt },
        });
      console.error('AVITO_EVENT_RETRY', event.id, errorCode);
      await delay(2000);
    }
  }
}
main()
  .catch(() => {
    console.error('AVITO_WORKER_STOP');
    process.exitCode = 78;
  })
  .finally(() => prisma.$disconnect());
