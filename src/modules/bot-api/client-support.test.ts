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
