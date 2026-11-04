import { expect, it, vi } from 'vitest';
import { sendClientSupport } from './client-support';
it('rejects another or unconfirmed fine before enqueueing a question', async () => {
  const tx = {
    fine: { findFirst: vi.fn().mockResolvedValue(null) },
    botNotificationJob: { createMany: vi.fn() },
  };
  await expect(
    sendClientSupport(
      { kind: 'CLIENT', companyId: 'c', clientId: 'cl' } as never,
      { text: 'Вопрос', fineId: 'other', key: 'question-123' },
      { $transaction: async (cb: (v: typeof tx) => unknown) => cb(tx) } as never,
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(tx.botNotificationJob.createMany).not.toHaveBeenCalled();
});

it('queues a client question in the shared Supa Pro block layout', async () => {
  const createMany = vi.fn().mockResolvedValue({ count: 1 });
  const tx = {
    fine: { findFirst: vi.fn().mockResolvedValue({ decreeNumber: '188-123' }) },
    telegramGroupBinding: { findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-1001' }) },
    botNotificationJob: { count: vi.fn().mockResolvedValue(0), createMany },
  };
  await sendClientSupport(
    {
      kind: 'CLIENT',
      companyId: 'c',
      clientId: 'cl',
      identityId: 'identity-1',
      displayName: 'Иванов Иван',
    } as never,
    { text: 'Я оплатил штраф вчера', fineId: 'fine-1', key: 'question-124' },
    { $transaction: async (cb: (v: typeof tx) => unknown) => cb(tx) } as never,
  );

  const message = createMany.mock.calls[0][0].data[0].payload.message as string;
  expect(message).toContain('💬 <b>Новый вопрос клиента</b>');
  expect(message).toContain('👤 <b>Клиент</b>\n└ Иванов Иван');
  expect(message).toContain('📄 <b>По вопросу</b>\n└ Штраф № <code>188-123</code>');
  expect(message).toContain('💬 <b>Сообщение</b>\n└ Я оплатил штраф вчера');
  expect(message).toContain('⚡ <b>Действие</b>');
});
