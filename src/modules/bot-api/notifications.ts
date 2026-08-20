import { randomUUID } from 'node:crypto';

import { prisma } from '@/database/prisma/client';
import { decryptField } from '@/services/security/field-encryption';

import { BotApiError } from './auth';

type ClaimDb = Pick<typeof prisma, '$transaction'>;
type UpdateDb = Pick<typeof prisma, 'botNotificationJob'>;
const LEASE_MS = 60_000;

export async function enqueueReturnReminders(now: Date, database = prisma) {
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const rentals = await database.rental.findMany({
    where: { status: { in: ['CONFIRMED', 'ACTIVE'] }, endsAt: { gt: now, lte: horizon } },
    take: 500,
    select: {
      id: true,
      companyId: true,
      clientId: true,
      endsAt: true,
      client: { select: { telegramIdentity: { select: { id: true, isActive: true } } } },
    },
  });
  const rows = rentals.flatMap((rental) => {
    const suffix = rental.endsAt.toISOString();
    const common = {
      companyId: rental.companyId,
      payload: { rentalId: rental.id },
      availableAt: now,
    };
    const staff = {
      ...common,
      chatId: `staff:${rental.companyId}`,
      eventKey: `rental-return:${rental.id}:${suffix}:24h:staff`,
      template: 'RENTAL_RETURN_STAFF',
    };
    const identity = rental.client.telegramIdentity;
    return identity?.isActive
      ? [
          staff,
          {
            ...common,
            identityId: identity.id,
            eventKey: `rental-return:${rental.id}:${suffix}:24h:client`,
            template: 'RENTAL_RETURN_CLIENT',
          },
        ]
      : [staff];
  });
  if (rows.length)
    await database.botNotificationJob.createMany({ data: rows, skipDuplicates: true });
  return rows.length;
}

async function hydrateJob(
  tx: Parameters<Parameters<ClaimDb['$transaction']>[0]>[0],
  job: {
    id: string;
    template: string;
    payload: unknown;
    chatId: string | null;
    claimToken: string | null;
    identity: { telegramUserId: string; isActive: boolean } | null;
  },
) {
  if (job.template !== 'RENTAL_RETURN_STAFF' && job.template !== 'RENTAL_RETURN_CLIENT') return job;
  const rentalId =
    typeof job.payload === 'object' && job.payload !== null && 'rentalId' in job.payload
      ? String(job.payload.rentalId)
      : '';
  const rental = await tx.rental.findFirst({
    where: { id: rentalId, status: { in: ['CONFIRMED', 'ACTIVE'] } },
    select: {
      contractNumber: true,
      endsAt: true,
      client: { select: { firstName: true, middleName: true, phoneEncrypted: true } },
      vehicle: { select: { make: true, modelName: true, model: true, registrationNumber: true } },
    },
  });
  if (!rental) return { ...job, payload: { message: 'Аренда уже недоступна.' } };
  const at = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(rental.endsAt);
  const vehicle =
    `${rental.vehicle.make ?? ''} ${rental.vehicle.modelName ?? rental.vehicle.model} ${rental.vehicle.registrationNumber ?? ''}`.trim();
  if (job.template === 'RENTAL_RETURN_CLIENT')
    return {
      ...job,
      payload: {
        message: `Напоминание: ${vehicle} нужно вернуть ${at}. Договор ${rental.contractNumber ?? 'без номера'}.`,
      },
    };
  const key = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  const phone = key ? decryptField(rental.client.phoneEncrypted, key) : 'телефон недоступен';
  const name = `${rental.client.firstName} ${rental.client.middleName ?? ''}`.trim();
  return {
    ...job,
    payload: {
      message: `Завтра возврат: ${vehicle}. ${name}, ${phone}. Договор ${rental.contractNumber ?? 'без номера'}, возврат ${at}.`,
    },
  };
}

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
      if (job) claimed.push(await hydrateJob(tx, job));
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
