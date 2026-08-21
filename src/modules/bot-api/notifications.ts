import { randomUUID } from 'node:crypto';

import { prisma } from '@/database/prisma/client';
import { decryptField } from '@/services/security/field-encryption';

import { BotApiError } from './auth';
import { moscowDayRange } from './daily-operations';

type ClaimDb = Pick<typeof prisma, '$transaction'>;
type UpdateDb = Pick<typeof prisma, 'botNotificationJob'>;
const LEASE_MS = 60_000;

interface DailyDigestInput {
  date: string;
  requests: number;
  rentals: number;
  returns: Array<{
    at: Date;
    client: string;
    vehicle: string;
    contractNumber: string | null;
  }>;
  freeVehicles: string[];
  service: number;
}

export function formatDailyOperationsDigest(input: DailyDigestInput) {
  const lines = [
    `Сводка Pilot+ на ${input.date}`,
    `Заявки: ${input.requests}`,
    `Аренды: ${input.rentals}`,
    `Возвраты сегодня: ${input.returns.length}`,
  ];
  lines.push(
    ...input.returns.map((item) => {
      const at = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        hour: '2-digit',
        minute: '2-digit',
      }).format(item.at);
      return `• ${at} · ${item.vehicle} · ${item.client} · ${item.contractNumber ?? 'без номера'}`;
    }),
  );
  lines.push(`Свободные машины: ${input.freeVehicles.length}`);
  lines.push(...input.freeVehicles.map((vehicle) => `• ${vehicle}`));
  lines.push(`На ТО / недоступны: ${input.service}`);
  return lines.join('\n');
}

function vehicleLabel(vehicle: {
  make: string | null;
  modelName: string | null;
  model: string;
  registrationNumber: string | null;
}) {
  const title = `${vehicle.make ?? ''} ${vehicle.modelName ?? vehicle.model}`.trim();
  return `${title} · ${vehicle.registrationNumber ?? 'без номера'}`;
}

export async function enqueueDailyOperationsDigests(now: Date, database = prisma) {
  const moscow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  if (moscow.getUTCHours() === 0 && moscow.getUTCMinutes() < 5) return 0;
  const date = moscow.toISOString().slice(0, 10);
  const bindings = await database.telegramGroupBinding.findMany({
    select: { companyId: true, telegramChatId: true },
    take: 500,
  });
  if (!bindings.length) return 0;
  const result = await database.botNotificationJob.createMany({
    data: bindings.map((binding) => ({
      companyId: binding.companyId,
      chatId: binding.telegramChatId,
      eventKey: `daily-operations:${binding.companyId}:${date}`,
      template: 'DAILY_OPERATIONS_DIGEST',
      payload: { date },
      availableAt: now,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

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
    companyId: string;
    template: string;
    payload: unknown;
    chatId: string | null;
    claimToken: string | null;
    identity: { telegramUserId: string; isActive: boolean } | null;
  },
) {
  if (job.template === 'DAILY_OPERATIONS_DIGEST') {
    const date =
      typeof job.payload === 'object' && job.payload !== null && 'date' in job.payload
        ? String(job.payload.date)
        : undefined;
    const range = moscowDayRange(date);
    const overlap = { startsAt: { lt: range.end }, endsAt: { gt: range.start } };
    const [requests, rentals, returns, vehicles] = await Promise.all([
      tx.botRentalRequest.count({
        where: { companyId: job.companyId, status: 'PENDING', ...overlap },
      }),
      tx.rental.count({
        where: { companyId: job.companyId, status: { in: ['CONFIRMED', 'ACTIVE'] }, ...overlap },
      }),
      tx.rental.findMany({
        where: {
          companyId: job.companyId,
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          endsAt: { gte: range.start, lt: range.end },
        },
        orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
        take: 200,
        select: {
          endsAt: true,
          contractNumber: true,
          client: { select: { firstName: true, lastName: true } },
          vehicle: {
            select: {
              make: true,
              modelName: true,
              model: true,
              registrationNumber: true,
            },
          },
        },
      }),
      tx.vehicle.findMany({
        where: { companyId: job.companyId, archivedAt: null },
        select: {
          status: true,
          make: true,
          modelName: true,
          model: true,
          registrationNumber: true,
          rentals: {
            where: { status: { in: ['CONFIRMED', 'ACTIVE'] }, ...overlap },
            select: { id: true },
            take: 1,
          },
          maintenanceRecords: {
            where: {
              status: { in: ['PLANNED', 'IN_PROGRESS', 'OVERDUE'] },
              scheduledAt: { lt: range.end },
              OR: [{ scheduledEndsAt: { gt: range.start } }, { scheduledEndsAt: null }],
            },
            select: { id: true },
            take: 1,
          },
        },
        take: 300,
      }),
    ]);
    const freeVehicles = vehicles.filter(
      (vehicle) =>
        vehicle.status !== 'MAINTENANCE' &&
        !vehicle.rentals.length &&
        !vehicle.maintenanceRecords.length,
    );
    const service = vehicles.filter(
      (vehicle) => vehicle.status === 'MAINTENANCE' || vehicle.maintenanceRecords.length,
    ).length;
    return {
      ...job,
      payload: {
        message: formatDailyOperationsDigest({
          date: range.date,
          requests,
          rentals,
          returns: returns.map((rental) => ({
            at: rental.endsAt,
            client: `${rental.client.lastName} ${rental.client.firstName}`.trim(),
            vehicle: vehicleLabel(rental.vehicle),
            contractNumber: rental.contractNumber,
          })),
          freeVehicles: freeVehicles.map(vehicleLabel),
          service,
        }),
      },
    };
  }
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
          companyId: true,
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
