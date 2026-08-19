import { randomUUID } from 'node:crypto';

import { prisma } from '@/database/prisma/client';

import { BotApiError } from './auth';

type ClaimDb = Pick<typeof prisma, '$transaction'>;
type UpdateDb = Pick<typeof prisma, 'botNotificationJob'>;
const LEASE_MS = 60_000;

export async function claimNotificationJobs(
  now: Date,
  workerId: string,
  database: ClaimDb = prisma,
) {
  if (!/^[A-Za-z0-9_-]{1,64}$/u.test(workerId)) throw new BotApiError('INVALID_REQUEST', 400);
  return database.$transaction(async (tx) => {
    const candidates = await tx.botNotificationJob.findMany({
      where: {
        availableAt: { lte: now },
        attempts: { lt: 5 },
        OR: [
          { status: { in: ['PENDING', 'ERROR'] }, claimToken: null },
          { status: 'PROCESSING', leaseExpiresAt: { lt: now } },
        ],
      },
      orderBy: [{ availableAt: 'asc' }, { id: 'asc' }],
      take: 25,
      select: { id: true, claimToken: true, leaseExpiresAt: true, status: true },
    });
    const claimed = [];
    for (const candidate of candidates) {
      const claimToken = `${workerId}:${candidate.id}:${randomUUID()}`;
      const updated = await tx.botNotificationJob.updateMany({
        where: {
          id: candidate.id,
          claimToken: candidate.claimToken,
          status: candidate.status,
          ...(candidate.status === 'PROCESSING'
            ? { leaseExpiresAt: candidate.leaseExpiresAt }
            : {}),
        },
        data: {
          status: 'PROCESSING',
          claimToken,
          leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
          attempts: { increment: 1 },
        },
      });
      if (updated.count !== 1) continue;
      const job = await tx.botNotificationJob.findUnique({
        where: { claimToken },
        select: {
          id: true,
          claimToken: true,
          template: true,
          payload: true,
          chatId: true,
          identity: { select: { telegramUserId: true, isActive: true } },
        },
      });
      if (job) claimed.push(job);
    }
    return claimed;
  });
}

export async function ackNotificationJob(
  id: string,
  claimToken: string,
  database: UpdateDb = prisma,
) {
  const result = await database.botNotificationJob.updateMany({
    where: { id, claimToken, status: 'PROCESSING', leaseExpiresAt: { gt: new Date() } },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      claimToken: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
    },
  });
  if (result.count !== 1) throw new BotApiError('CLAIM_LOST', 409);
}

export async function rescheduleNotificationJob(
  id: string,
  claimToken: string,
  errorCode: string,
  database: UpdateDb = prisma,
) {
  const current = await database.botNotificationJob.findFirst({
    where: { id, claimToken, status: 'PROCESSING' },
    select: { attempts: true },
  });
  if (!current) throw new BotApiError('CLAIM_LOST', 409);
  const terminal = current.attempts >= 5;
  const delay = Math.min(15 * 60_000, 15_000 * 2 ** Math.max(0, current.attempts - 1));
  const result = await database.botNotificationJob.updateMany({
    where: { id, claimToken, status: 'PROCESSING' },
    data: {
      status: 'ERROR',
      claimToken: null,
      leaseExpiresAt: null,
      lastErrorCode: errorCode.slice(0, 64),
      availableAt: terminal ? new Date('9999-12-31T00:00:00Z') : new Date(Date.now() + delay),
    },
  });
  if (result.count !== 1) throw new BotApiError('CLAIM_LOST', 409);
}
