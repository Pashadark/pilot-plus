import { expect, it, vi } from 'vitest';
import { queueAvitoReminder } from './reminder';
import { encryptField } from '@/services/security/field-encryption';
import { advanceDialogue, emptyDialogue } from './dialogue-policy';
import type { PrismaClient } from '@/database/generated/prisma';
const key = Buffer.alloc(32, 1).toString('base64');
it('queues one staff message and marks the waiting episode in the same transaction', async () => {
  const clock = advanceDialogue(emptyDialogue(), {
    kind: 'customer',
    id: 'm1',
    at: '2026-09-24T00:00:00Z',
  });
  const state = { clock };
  const tx = {
    avitoDialogue: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'd',
        companyId: 'c',
        accountId: '11',
        chatId: 'chat',
        contentEncrypted: encryptField(JSON.stringify(state), key),
      }),
      update: vi.fn(),
    },
    telegramGroupBinding: { findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-123' }) },
    botNotificationJob: { createMany: vi.fn() },
  };
  const db = { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } as unknown as Pick<
    PrismaClient,
    '$transaction'
  >;
  await queueAvitoReminder(
    'd',
    { companyId: 'c', accountId: '11', encryptionKey: key },
    new Date('2026-09-24T00:15:00Z'),
    db,
  );
  expect(tx.botNotificationJob.createMany.mock.calls[0][0].data[0]).toMatchObject({
    template: 'AVITO_WAITING',
    chatId: '-123',
    eventKey: 'avito-wait:d:m1',
    payload: { message: expect.stringContaining('Клиент Авито ждёт ответа менеджера') },
  });
  expect(tx.avitoDialogue.update).toHaveBeenCalled();
  tx.avitoDialogue.findUnique.mockResolvedValueOnce({
    id: 'd',
    companyId: 'c',
    accountId: '11',
    contentEncrypted: encryptField(
      JSON.stringify({ clock: { ...clock, waitingSince: null } }),
      key,
    ),
  });
  tx.botNotificationJob.createMany.mockClear();
  await queueAvitoReminder(
    'd',
    { companyId: 'c', accountId: '11', encryptionKey: key },
    new Date('2026-09-24T00:16:00Z'),
    db,
  );
  expect(tx.botNotificationJob.createMany).not.toHaveBeenCalled();
});
