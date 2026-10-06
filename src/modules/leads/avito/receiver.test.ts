import { describe, expect, it, vi } from 'vitest';
import { acceptCallback } from './receiver';
import type { PrismaClient } from '@/database/generated/prisma';
const secret = 'a'.repeat(64);
const config = { secret, accountId: '11', companyId: 'company' };
const body = { payload: { type: 'message', value: { id: 'm1', chat_id: 'chat', user_id: 11 } } };
describe('Avito webhook receiver', () => {
  const makeDb = () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    return {
      createMany,
      db: {
        $transaction: async (fn: (tx: unknown) => unknown) =>
          fn({ avitoInboxEvent: { count: async () => 0, createMany } }),
      } as unknown as Pick<PrismaClient, '$transaction'>,
    };
  };
  it('rejects unauthenticated payload before database work', async () => {
    const { db, createMany } = makeDb();
    expect(
      (
        await acceptCallback(
          new Request('https://test', { method: 'POST', body: JSON.stringify(body) }),
          'wrong',
          config,
          db,
        )
      ).status,
    ).toBe(404);
    expect(createMany).not.toHaveBeenCalled();
  });
  it('queues IDs only with deterministic idempotency key', async () => {
    const { db, createMany } = makeDb();
    expect(
      (
        await acceptCallback(
          new Request('https://test', { method: 'POST', body: JSON.stringify(body) }),
          secret,
          config,
          db,
        )
      ).status,
    ).toBe(200);
    expect(createMany.mock.calls[0][0].data[0]).toMatchObject({
      companyId: 'company',
      messageId: 'm1',
      chatId: 'chat',
    });
    expect(createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });
  it('rejects oversized streamed body without trusting content-length', async () => {
    const { db, createMany } = makeDb();
    expect(
      (
        await acceptCallback(
          new Request('https://test', { method: 'POST', body: 'x'.repeat(17000) }),
          secret,
          config,
          db,
        )
      ).status,
    ).toBe(413);
    expect(createMany).not.toHaveBeenCalled();
  });
});
