import { expect, it, vi } from 'vitest';
import { saveAssistantEvent } from './assistant-store';
import type { PrismaClient } from '@/database/generated/prisma';
import { decryptField } from '@/services/security/field-encryption';
const config = {
  companyId: 'c',
  accountId: '11',
  encryptionKey: Buffer.alloc(32, 1).toString('base64'),
  enabledAt: new Date('2026-09-24T00:00:00Z'),
};
function fixture() {
  const tx = {
    avitoDialogue: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() },
    avitoOutgoing: { findFirst: vi.fn().mockResolvedValue(null), createMany: vi.fn() },
  };
  return {
    tx,
    db: { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } as unknown as Pick<
      PrismaClient,
      '$transaction'
    >,
  };
}
const input = {
  chatId: 'chat',
  leadId: 'lead',
  eligible: true,
  message: {
    id: 'm1',
    created: 1790244000,
    author_id: 22,
    direction: 'in',
    type: 'text',
    content: { text: 'Камри на пять дней' },
  },
};
it('persists encrypted dialogue and queues questions with a stable unique event key', async () => {
  const { tx, db } = fixture();
  await saveAssistantEvent(input, config, db);
  const saved = tx.avitoDialogue.upsert.mock.calls[0][0].create;
  const state = JSON.parse(decryptField(saved.contentEncrypted, config.encryptionKey));
  expect(state.request.model).toBe('Toyota Camry');
  expect(saved.reminderAt).toEqual(new Date((input.message.created + 900) * 1000));
  const outgoing = tx.avitoOutgoing.createMany.mock.calls[0][0].data[0];
  expect(decryptField(outgoing.textEncrypted, config.encryptionKey)).not.toContain(
    'Какой автомобиль',
  );
  expect(outgoing.state).toBe('PENDING');
});
it('ignores sales and historical messages without writing or sending', async () => {
  for (const event of [
    { ...input, eligible: false },
    { ...input, message: { ...input.message, created: 1 } },
  ]) {
    const { tx, db } = fixture();
    await saveAssistantEvent(event, config, db);
    expect(tx.avitoDialogue.upsert).not.toHaveBeenCalled();
    expect(tx.avitoOutgoing.createMany).not.toHaveBeenCalled();
  }
});
it('does not send a customer reply when every requested detail is supplied', async () => {
  const { tx, db } = fixture();
  await saveAssistantEvent(
    {
      ...input,
      message: {
        ...input.message,
        content: {
          text: 'Polo с 25.09.2026 14:00 до 28.09.2026 16:30. Общий пробег 1200 км. 89991234567',
        },
      },
    },
    config,
    db,
  );
  expect(tx.avitoOutgoing.createMany).not.toHaveBeenCalled();
});
it.each(['SENT', 'SENDING', 'UNKNOWN'])('does not queue another answer after %s', async (state) => {
  const { tx, db } = fixture();
  tx.avitoOutgoing.findFirst.mockResolvedValue({ state });
  await saveAssistantEvent(input, config, db);
  expect(tx.avitoOutgoing.createMany).not.toHaveBeenCalled();
  expect(tx.avitoDialogue.upsert).toHaveBeenCalledOnce();
});
