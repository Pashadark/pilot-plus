import { describe, expect, it, vi } from 'vitest';

import {
  ackNotificationJob,
  claimNotificationJobs,
  enqueueDailyOperationsDigests,
  enqueueReturnReminders,
} from './notifications';

describe('bot notification leases', () => {
  it('enqueues one idempotent daily digest per bound company after 00:05 Moscow', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const database = {
      telegramGroupBinding: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ companyId: 'company-1', telegramChatId: '-100777' }]),
      },
      botNotificationJob: { createMany },
    };
    await expect(
      enqueueDailyOperationsDigests(new Date('2026-08-19T21:05:00Z'), database as never),
    ).resolves.toBe(1);
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            eventKey: 'daily-operations:company-1:2026-08-20',
            chatId: '-100777',
            template: 'DAILY_OPERATIONS_DIGEST',
          }),
        ],
      }),
    );
  });
  it('returns only rows successfully claimed by this worker', async () => {
    const tx = {
      botNotificationJob: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'job-1', claimToken: null },
          { id: 'job-2', claimToken: 'old' },
        ]),
        updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'job-1',
          claimToken: 'worker:job-1',
          template: 'RETURN',
          payload: {},
          identity: { telegramUserId: '123' },
          chatId: null,
        }),
      },
    };
    const database = { $transaction: vi.fn(async (callback) => callback(tx)) };
    const jobs = await claimNotificationJobs(
      new Date('2026-08-19T10:00:00Z'),
      'worker',
      database as never,
    );
    expect(jobs.map((job) => job.id)).toEqual(['job-1']);
  });

  it('acks only the exact live claim token', async () => {
    const database = {
      botNotificationJob: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    await expect(
      ackNotificationJob('job-1', 'wrong-token', database as never),
    ).rejects.toMatchObject({ code: 'CLAIM_LOST' });
  });

  it('enqueues one id-only reminder per target without storing client PII', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const database = {
      rental: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'r1',
            companyId: 'c1',
            clientId: 'cl1',
            endsAt: new Date('2026-08-20T09:00:00Z'),
            client: { telegramIdentity: { id: 'i1', isActive: true } },
          },
        ]),
      },
      botNotificationJob: { createMany },
    };
    await enqueueReturnReminders(new Date('2026-08-19T10:00:00Z'), database as never);
    const rows = createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).toContain('"rentalId":"r1"');
    expect(JSON.stringify(rows)).not.toMatch(/phone|firstName|middleName/iu);
  });
});
