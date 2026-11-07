import { randomUUID } from 'node:crypto';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { IMPOUND_LOTS } from '@/modules/geography/impound-lots';
import {
  isCompleteWeeklyInspection,
  moscowWeekRange,
  weeklyInspectionRequiredMedia,
} from '@/modules/rentals/lease-to-own/weekly-inspection';
import {
  isLowFuelLevel,
  FUEL_RECOVERY_PERCENT,
  selectFreshFuelReading,
} from '@/modules/vehicles/fuel-level';
import { OFFLINE_AFTER_MS } from '@/modules/vehicles/gps-status';
import { decryptField } from '@/services/security/field-encryption';

import { BotApiError } from './auth';
import { moscowDayRange } from './daily-operations';
import { formatLeadCreatedMessage, formatLeadStatusChangedMessage } from './lead-notifications';
import {
  classifyGpsSilence,
  classifyRentalDeadline,
  formatClientGpsEvent,
  formatOperationalAlertForAudience,
} from './operational-alerts';
import { formatOperationsDigestParts } from './operations-digest';
import { formatRentalRequestMessage } from './rental-request-notifications';
import {
  formatClientReturnReminderMessage,
  formatRentalLifecycleMessage,
  formatRentalExtensionMessage,
  formatTomorrowReturnMessage,
} from './rental-lifecycle-notifications';
import { formatUnpaidFinesReport } from './unpaid-fines-report';
import { formatTelegramMessage, telegramSection } from './telegram-message';
import { returnReminderStage } from './client-return-reminders';
import { notificationDestination } from './notification-routing';
import { findDueLeasePayment, formatLeasePaymentReminderMessage } from './lease-payment-reminders';
import type { BotIdentityContext } from './queries';

type ClaimDb = Pick<typeof prisma, '$transaction'>;
type UpdateDb = Pick<typeof prisma, 'botNotificationJob'>;
const LEASE_MS = 60_000;

function vehicleTitle(vehicle: { make: string | null; modelName: string | null; model: string }) {
  return `${vehicle.make ?? ''} ${vehicle.modelName ?? vehicle.model}`.trim();
}

function personName(person: { firstName: string; middleName: string | null; lastName: string }) {
  return [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ');
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function decryptedPhone(value: string | null | undefined): string | null {
  const key = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  if (!key || !value) return null;
  try {
    return decryptField(value, key);
  } catch {
    return null;
  }
}

function numberOrNull(value: unknown | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function leadPayloadId(payload: unknown, key: 'leadId' | 'auditId') {
  const record =
    typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
  return record && key in record ? String(record[key]) : '';
}

function leadStatusTransition(
  changes: unknown,
  fallbackStatus: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'BOOKED' | 'LOST',
) {
  const allowed = new Set(['NEW', 'CONTACTED', 'QUALIFIED', 'BOOKED', 'LOST']);
  if (!changes || typeof changes !== 'object' || !('status' in changes)) {
    return { previousStatus: fallbackStatus, status: fallbackStatus };
  }
  const status = changes.status;
  if (!status || typeof status !== 'object') {
    return { previousStatus: fallbackStatus, status: fallbackStatus };
  }
  const from = 'from' in status ? String(status.from) : '';
  const to = 'to' in status ? String(status.to) : '';
  return {
    previousStatus: allowed.has(from) ? (from as typeof fallbackStatus) : fallbackStatus,
    status: allowed.has(to) ? (to as typeof fallbackStatus) : fallbackStatus,
  };
}

function publicLeadsUrl() {
  const configured = process.env.PILOT_PUBLIC_APP_URL?.trim();
  if (!configured) return 'https://supapro.ru/leads';
  try {
    const url = new URL('/leads', configured);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : 'https://supapro.ru/leads';
  } catch {
    return 'https://supapro.ru/leads';
  }
}

function publicAppUrl(path: string) {
  const configured = process.env.PILOT_PUBLIC_APP_URL?.trim() || 'https://supapro.ru';
  try {
    const url = new URL(path, configured);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function phoneAction(phone: string | null) {
  if (!phone) return null;
  let digits = phone.replace(/\D/gu, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return /^7\d{10}$/u.test(digits)
    ? { type: 'phone_url', label: '📞 Позвонить', url: `tel:+${digits}` }
    : null;
}

export async function enqueueDailyOperationsDigests(now: Date, database = prisma) {
  const moscow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  if (moscow.getUTCHours() !== 8 || moscow.getUTCMinutes() >= 15) return 0;
  const date = moscow.toISOString().slice(0, 10);
  const bindings = await database.telegramGroupBinding.findMany({
    select: { companyId: true, telegramChatId: true, boundByUserId: true },
    take: 500,
  });
  if (!bindings.length) return 0;
  const digestParts = ['critical', 'trackers', 'totals'] as const;
  const rows: Prisma.BotNotificationJobCreateManyInput[] = bindings.flatMap((binding) => {
    const finesCommon = {
      companyId: binding.companyId,
      template: 'DAILY_UNPAID_FINES',
      payload: { date },
      availableAt: new Date(now.getTime() + 3_000),
    };
    const operationsGroup = digestParts.map((part, index) => ({
      companyId: binding.companyId,
      template: 'DAILY_OPERATIONS_DIGEST',
      payload: { date, part },
      availableAt: new Date(now.getTime() + index * 1_000),
      chatId: binding.telegramChatId,
      eventKey: `daily-operations:${binding.companyId}:${date}:group:${part}`,
    }));
    const finesGroup = {
      ...finesCommon,
      chatId: binding.telegramChatId,
      eventKey: `daily-unpaid-fines:${binding.companyId}:${date}:group`,
    };
    return [...operationsGroup, finesGroup];
  });
  if (moscow.getUTCDay() === 5) {
    const week = moscowWeekRange(now);
    const leaseRentals = await database.rental.findMany({
      where: {
        companyId: { in: bindings.map((binding) => binding.companyId) },
        agreementType: 'LEASE_TO_OWN',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        companyId: true,
        contractNumber: true,
        client: { select: { firstName: true, middleName: true, lastName: true } },
        vehicle: {
          select: { make: true, modelName: true, model: true, registrationNumber: true },
        },
        operations: {
          where: {
            type: 'WEEKLY_INSPECTION',
            status: 'COMMITTED',
            occurredAt: { gte: week.start, lt: week.end },
          },
          select: {
            media: { where: { status: 'CLEAN' }, select: { kind: true } },
          },
        },
      },
      take: 500,
    });
    const bindingByCompany = new Map(bindings.map((binding) => [binding.companyId, binding]));
    for (const rental of leaseRentals) {
      if (
        rental.operations.some((operation) =>
          isCompleteWeeklyInspection(operation.media.map((medium) => medium.kind)),
        )
      ) {
        continue;
      }
      const binding = bindingByCompany.get(rental.companyId);
      if (!binding) continue;
      const vehicle = [rental.vehicle.make, rental.vehicle.modelName ?? rental.vehicle.model]
        .filter(Boolean)
        .join(' ');
      const client = [rental.client.lastName, rental.client.firstName, rental.client.middleName]
        .filter(Boolean)
        .join(' ');
      rows.push({
        companyId: rental.companyId,
        chatId: binding.telegramChatId,
        template: 'LEASE_TO_OWN_WEEKLY_INSPECTION',
        eventKey: `lease-to-own-inspection:${rental.companyId}:${rental.id}:${week.weekKey}:group`,
        availableAt: now,
        payload: {
          message: formatTelegramMessage({
            title: '🟠 <b>Не пройден еженедельный осмотр</b>',
            sections: [
              telegramSection('🚗', 'Авто', [
                `${escapeHtml(vehicle)} · <code>${escapeHtml(rental.vehicle.registrationNumber ?? 'без номера')}</code>`,
                `📄 Договор: <code>${escapeHtml(rental.contractNumber ?? 'без номера')}</code>`,
              ]),
              telegramSection('👤', 'Клиент', [escapeHtml(client)]),
              telegramSection('📷', 'Не хватает', [
                'Фото приборной панели',
                'Фото кузова с четырёх сторон',
                'Видео автомобиля',
              ]),
            ],
            action: 'Связаться с клиентом и запросить материалы',
          }),
          parseMode: 'HTML',
          actions: [
            {
              type: 'contract_url',
              label: 'Открыть осмотр',
              url: `https://supapro.ru/rentals/${encodeURIComponent(rental.id)}?action=weekly-inspection#rental-actions`,
            },
          ],
          requiredMedia: [...weeklyInspectionRequiredMedia],
        },
      });
    }
  }
  const result = await database.botNotificationJob.createMany({
    data: rows,
    skipDuplicates: true,
  });
  return result.count;
}

export async function enqueueOperationsDigestRefresh(
  identity: BotIdentityContext,
  date: string,
  now: Date,
  database = prisma,
) {
  if (identity.kind !== 'STAFF' || !identity.userId) throw new BotApiError('FORBIDDEN', 403);
  const range = moscowDayRange(date);
  const binding = await database.telegramGroupBinding.findFirst({
    where: { companyId: identity.companyId },
    select: { telegramChatId: true },
  });
  if (!binding) throw new BotApiError('GROUP_NOT_CONFIGURED', 409);
  const minuteBucket = Math.floor(now.getTime() / 60_000);
  const parts = ['critical', 'trackers', 'totals'] as const;
  const result = await database.botNotificationJob.createMany({
    data: parts.map((part, index) => ({
      companyId: identity.companyId,
      chatId: binding.telegramChatId,
      template: 'DAILY_OPERATIONS_DIGEST',
      payload: { date: range.date, part },
      availableAt: new Date(now.getTime() + index * 1_000),
      eventKey: `daily-operations-refresh:${identity.companyId}:${identity.identityId}:${range.date}:${minuteBucket}:${part}`,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

export async function enqueueOperationalAlerts(now: Date, database = prisma) {
  if (now.getUTCMinutes() % 15 !== 0 || now.getUTCSeconds() >= 45) return 0;
  const bindings = await database.telegramGroupBinding.findMany({
    select: { companyId: true, telegramChatId: true, boundByUserId: true },
    take: 500,
  });
  if (!bindings.length) return 0;
  const companyIds = [...new Set(bindings.map((binding) => binding.companyId))];
  const identities = await database.telegramIdentity.findMany({
    where: {
      kind: 'STAFF',
      isActive: true,
      OR: bindings.map((binding) => ({
        companyId: binding.companyId,
        userId: binding.boundByUserId,
      })),
    },
    select: { id: true, companyId: true, userId: true },
    take: 500,
  });
  const identityByBinding = new Map(
    identities.map((identity) => [`${identity.companyId}:${identity.userId}`, identity.id]),
  );
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60_000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60_000);
  const recentEventsSince = new Date(now.getTime() - 20 * 60_000);
  const [vehicles, rentals, events, fines] = await Promise.all([
    database.vehicle.findMany({
      where: { companyId: { in: companyIds }, archivedAt: null, isDemoImport: false },
      select: {
        id: true,
        companyId: true,
        positions: {
          where: { provider: 'GLONASSSOFT' },
          select: { id: true, recordedAt: true, fuelLevelPercent: true },
          orderBy: [{ recordedAt: 'desc' as const }, { id: 'desc' as const }],
          take: 1,
        },
        rentalOperations: {
          where: { status: 'COMMITTED' as const, fuelLevelPercent: { not: null } },
          select: { id: true, occurredAt: true, fuelLevelPercent: true },
          orderBy: [{ occurredAt: 'desc' as const }, { id: 'desc' as const }],
          take: 1,
        },
        rentals: {
          where: { status: { in: ['CONFIRMED' as const, 'ACTIVE' as const] } },
          select: { id: true },
          orderBy: { endsAt: 'desc' as const },
          take: 1,
        },
      },
      take: 500,
    }),
    database.rental.findMany({
      where: {
        companyId: { in: companyIds },
        status: { in: ['CONFIRMED', 'ACTIVE'] },
        OR: [{ endsAt: { gte: now, lte: twoHoursFromNow } }, { endsAt: { lte: twoHoursAgo } }],
      },
      select: { id: true, companyId: true, vehicleId: true, endsAt: true },
      take: 500,
    }),
    database.vehicleEvent.findMany({
      where: {
        vehicle: { companyId: { in: companyIds }, archivedAt: null, isDemoImport: false },
        recordedAt: { gte: recentEventsSince, lte: now },
      },
      select: {
        id: true,
        vehicleId: true,
        type: true,
        vehicle: { select: { companyId: true } },
      },
      take: 500,
    }),
    database.fine.findMany({
      where: {
        companyId: { in: companyIds },
        createdAt: { gte: recentEventsSince, lte: now },
        status: { not: 'CANCELLED' },
      },
      select: { id: true, companyId: true, vehicleId: true },
      take: 500,
    }),
  ]);

  type Alert = {
    companyId: string;
    eventKey: string;
    payload: {
      kind: string;
      vehicleId: string;
      rentalId?: string;
      eventId?: string;
      fineId?: string;
      fuelLevelPercent?: number;
    };
  };
  const alerts: Alert[] = [];

  // Fuel observations have their own selection: a newer GPS-only sample must not erase valid fuel.
  const fuelVehicles = await database.vehicle.findMany({
    where: { companyId: { in: companyIds }, archivedAt: null, isDemoImport: false },
    select: {
      id: true,
      positions: {
        where: {
          provider: 'GLONASSSOFT',
          fuelLevelPercent: { not: null },
          recordedAt: { lte: now },
        },
        select: { id: true, recordedAt: true, fuelLevelPercent: true },
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
        take: 1,
      },
      rentalOperations: {
        where: { status: 'COMMITTED', fuelLevelPercent: { not: null }, occurredAt: { lte: now } },
        select: { id: true, occurredAt: true, fuelLevelPercent: true },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 1,
      },
    },
  });
  const fuelByVehicle = new Map(fuelVehicles.map((vehicle) => [vehicle.id, vehicle]));
  const lowFuelAlerts = await Promise.all(
    vehicles.map(async (vehicle): Promise<Alert | null> => {
      const fuelVehicle = fuelByVehicle.get(vehicle.id);
      const currentPosition = fuelVehicle?.positions[0] ?? null;
      const currentOperation = fuelVehicle?.rentalOperations?.[0] ?? null;
      const reading = selectFreshFuelReading(
        [
          ...(currentPosition
            ? [
                {
                  fuelLevelPercent: numberOrNull(currentPosition.fuelLevelPercent),
                  observedAt: currentPosition.recordedAt,
                },
              ]
            : []),
          ...(currentOperation
            ? [
                {
                  fuelLevelPercent: numberOrNull(currentOperation.fuelLevelPercent),
                  observedAt: currentOperation.occurredAt,
                },
              ]
            : []),
        ],
        now,
      );
      const fuelLevelPercent = reading?.fuelLevelPercent ?? null;
      if (!isLowFuelLevel(fuelLevelPercent)) return null;
      const [lastRecoveredPosition, lastRecoveredOperation] = await Promise.all([
        database.vehiclePosition.findFirst({
          where: {
            vehicleId: vehicle.id,
            provider: 'GLONASSSOFT',
            fuelLevelPercent: { gte: FUEL_RECOVERY_PERCENT, lte: 100 },
            recordedAt: { lt: reading!.observedAt },
          },
          select: { id: true, recordedAt: true },
          orderBy: [{ recordedAt: 'desc' as const }, { id: 'desc' as const }],
        }),
        database.rentalOperation.findFirst({
          where: {
            companyId: vehicle.companyId,
            vehicleId: vehicle.id,
            status: 'COMMITTED',
            fuelLevelPercent: { gte: FUEL_RECOVERY_PERCENT, lte: 100 },
            occurredAt: { lt: reading!.observedAt },
          },
          select: { id: true, occurredAt: true },
          orderBy: [{ occurredAt: 'desc' as const }, { id: 'desc' as const }],
        }),
      ]);
      const recovery =
        lastRecoveredOperation &&
        (!lastRecoveredPosition ||
          lastRecoveredOperation.occurredAt > lastRecoveredPosition.recordedAt)
          ? `operation:${lastRecoveredOperation.id}`
          : lastRecoveredPosition
            ? `position:${lastRecoveredPosition.id}`
            : 'initial';
      return {
        companyId: vehicle.companyId,
        eventKey: `fuel:${vehicle.id}:${recovery}`,
        payload: {
          kind: 'LOW_FUEL',
          vehicleId: vehicle.id,
          fuelLevelPercent: Math.round(fuelLevelPercent as number),
        },
      };
    }),
  );
  alerts.push(...lowFuelAlerts.filter((alert): alert is Alert => alert !== null));

  for (const vehicle of vehicles) {
    const rentalId = vehicle.rentals[0]?.id;
    const lastSignalAt = vehicle.positions[0]?.recordedAt ?? null;
    const kind = classifyGpsSilence({
      isRented: Boolean(rentalId),
      silentForMs: lastSignalAt ? now.getTime() - lastSignalAt.getTime() : 365 * 24 * 60 * 60_000,
    });
    if (!kind) continue;
    alerts.push({
      companyId: vehicle.companyId,
      eventKey: `gps:${vehicle.id}:${kind}:${lastSignalAt?.toISOString() ?? 'never'}`,
      payload: { kind, vehicleId: vehicle.id, ...(rentalId ? { rentalId } : {}) },
    });
  }
  for (const rental of rentals) {
    const kind = classifyRentalDeadline(now.getTime() - rental.endsAt.getTime());
    if (!kind) continue;
    alerts.push({
      companyId: rental.companyId,
      eventKey: `rental:${rental.id}:${kind}:${rental.endsAt.toISOString()}`,
      payload: { kind, vehicleId: rental.vehicleId, rentalId: rental.id },
    });
  }
  for (const event of events) {
    const normalizedType = event.type.toUpperCase();
    const kind = /GEOFENCE|ZONE|ГЕОЗОН/iu.test(normalizedType)
      ? 'GEOFENCE_EXIT'
      : /SPEED|СКОРОСТ/iu.test(normalizedType)
        ? 'SPEEDING'
        : null;
    if (!kind) continue;
    alerts.push({
      companyId: event.vehicle.companyId,
      eventKey: `telemetry:${event.id}:${kind}`,
      payload: { kind, vehicleId: event.vehicleId, eventId: event.id },
    });
  }
  for (const fine of fines) {
    if (!fine.vehicleId) continue;
    alerts.push({
      companyId: fine.companyId,
      eventKey: `fine:${fine.id}:created`,
      payload: { kind: 'NEW_FINE', vehicleId: fine.vehicleId, fineId: fine.id },
    });
  }

  const rows = alerts.flatMap((alert) =>
    bindings
      .filter((binding) => binding.companyId === alert.companyId)
      .flatMap((binding) => {
        const common = {
          companyId: alert.companyId,
          template: 'OPERATIONAL_ALERT',
          payload: alert.payload,
          availableAt: now,
        };
        const group = {
          ...common,
          chatId: binding.telegramChatId,
          eventKey: `operational:${alert.eventKey}:group:${binding.telegramChatId}`,
        };
        const identityId = identityByBinding.get(`${binding.companyId}:${binding.boundByUserId}`);
        return identityId
          ? [
              group,
              {
                ...common,
                identityId,
                eventKey: `operational:${alert.eventKey}:staff:${identityId}`,
              },
            ]
          : [group];
      }),
  );
  if (!rows.length) return 0;
  const result = await database.botNotificationJob.createMany({
    data: rows.filter((row) => !('identityId' in row)),
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
    const stage = returnReminderStage(now, rental.endsAt);
    if (!stage) return [];
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
            eventKey: `rental-return:${rental.id}:${suffix}:${stage}:client`,
            template: 'RENTAL_RETURN_CLIENT',
            payload: { rentalId: rental.id, endsAt: suffix, stage },
          },
        ]
      : [staff];
  });
  if (rows.length)
    await database.botNotificationJob.createMany({ data: rows, skipDuplicates: true });
  return rows.length;
}

export async function enqueueManualReturnReminder(
  identity: BotIdentityContext,
  rentalId: string,
  now: Date,
  database = prisma,
) {
  if (identity.kind !== 'STAFF') throw new BotApiError('FORBIDDEN', 403);
  const rental = await database.rental.findFirst({
    where: {
      id: rentalId,
      companyId: identity.companyId,
      status: { in: ['CONFIRMED', 'ACTIVE'] },
    },
    select: {
      id: true,
      companyId: true,
      client: { select: { telegramIdentity: { select: { id: true, isActive: true } } } },
    },
  });
  if (!rental) throw new BotApiError('RENTAL_NOT_FOUND', 404);
  if (!rental.client.telegramIdentity?.isActive) {
    throw new BotApiError('CLIENT_TELEGRAM_NOT_LINKED', 409);
  }
  const minute = now.toISOString().slice(0, 16);
  const result = await database.botNotificationJob.createMany({
    data: [
      {
        companyId: rental.companyId,
        identityId: rental.client.telegramIdentity.id,
        eventKey: `manual-return-reminder:${rental.id}:${minute}`,
        template: 'RENTAL_RETURN_CLIENT',
        payload: { rentalId: rental.id, manual: true },
        availableAt: now,
      },
    ],
    skipDuplicates: true,
  });
  return result.count > 0;
}

export async function enqueueManualClientImpoundAlert(
  identity: BotIdentityContext,
  rentalId: string,
  now: Date,
  database = prisma,
) {
  if (identity.kind !== 'STAFF') throw new BotApiError('FORBIDDEN', 403);
  const rental = await database.rental.findFirst({
    where: {
      id: rentalId,
      companyId: identity.companyId,
      status: { in: ['CONFIRMED', 'ACTIVE'] },
    },
    select: {
      id: true,
      companyId: true,
      client: { select: { telegramIdentity: { select: { id: true, isActive: true } } } },
    },
  });
  if (!rental) throw new BotApiError('RENTAL_NOT_FOUND', 404);
  if (!rental.client.telegramIdentity?.isActive) {
    throw new BotApiError('CLIENT_TELEGRAM_NOT_LINKED', 409);
  }
  const minute = now.toISOString().slice(0, 16);
  const result = await database.botNotificationJob.createMany({
    data: [
      {
        companyId: rental.companyId,
        identityId: rental.client.telegramIdentity.id,
        eventKey: `manual-impound-alert:${rental.id}:${minute}`,
        template: 'CLIENT_IMPOUND_ALERT',
        payload: { rentalId: rental.id },
        availableAt: now,
      },
    ],
    skipDuplicates: true,
  });
  return result.count > 0;
}

async function hydrateJob(
  tx: Parameters<Parameters<ClaimDb['$transaction']>[0]>[0],
  now: Date,
  job: {
    id: string;
    companyId: string;
    template: string;
    payload: unknown;
    chatId: string | null;
    claimToken: string | null;
    identity: {
      telegramUserId: string;
      isActive: boolean;
      clientId: string | null;
      companyId: string;
      kind: string;
    } | null;
  },
) {
  if (
    job.template === 'LEASE_TO_OWN_PAYMENT_STAFF' ||
    job.template === 'LEASE_TO_OWN_PAYMENT_CLIENT'
  ) {
    const customer = job.template === 'LEASE_TO_OWN_PAYMENT_CLIENT';
    if (
      customer &&
      (!job.identity?.isActive ||
        job.identity.kind !== 'CLIENT' ||
        !job.identity.clientId ||
        job.identity.companyId !== job.companyId)
    ) {
      return null;
    }
    const payload =
      typeof job.payload === 'object' && job.payload !== null
        ? (job.payload as Record<string, unknown>)
        : {};
    const rentalId = String(payload.rentalId ?? '');
    const paymentNumber = Number(payload.paymentNumber);
    const dueDate = String(payload.dueDate ?? '');
    if (
      !rentalId ||
      !Number.isInteger(paymentNumber) ||
      paymentNumber < 1 ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(dueDate)
    ) {
      return null;
    }
    const rental = await tx.rental.findFirst({
      where: {
        id: rentalId,
        companyId: job.companyId,
        agreementType: 'LEASE_TO_OWN',
        status: 'ACTIVE',
        ...(customer ? { clientId: job.identity!.clientId! } : {}),
      },
      select: {
        snapshot: true,
        contractNumber: true,
        client: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
            phoneEncrypted: true,
          },
        },
        vehicle: {
          select: { make: true, modelName: true, model: true, registrationNumber: true },
        },
      },
    });
    const payment = rental ? findDueLeasePayment(rental.snapshot, dueDate) : null;
    if (!rental || !payment || payment.number !== paymentNumber) return null;
    const contractUrl = publicAppUrl(`/rentals/${encodeURIComponent(rentalId)}`);
    return {
      ...job,
      payload: {
        message: formatLeasePaymentReminderMessage({
          vehicle: vehicleTitle(rental.vehicle),
          registrationNumber: rental.vehicle.registrationNumber,
          clientName: personName(rental.client),
          contractNumber: rental.contractNumber,
          phone: customer ? null : decryptedPhone(rental.client.phoneEncrypted),
          paymentNumber: payment.number,
          dueAt: new Date(payment.dueAt),
          amountMinor: payment.amountMinor,
          action: customer
            ? 'Внести оплату; если нужна помощь — связаться с менеджером'
            : 'Связаться с клиентом и подтвердить оплату',
        }),
        parseMode: 'HTML',
        ...(customer
          ? { clientMenu: true }
          : {
              actions: contractUrl
                ? [
                    {
                      type: 'contract_url',
                      label: '📄 Открыть договор',
                      url: contractUrl,
                    },
                  ]
                : [],
            }),
      },
    };
  }
  if (job.template === 'BOT_RENTAL_REQUEST_CREATED') {
    const payload =
      typeof job.payload === 'object' && job.payload !== null
        ? (job.payload as Record<string, unknown>)
        : {};
    const requestId = String(payload.requestId ?? '');
    const request = requestId
      ? await tx.botRentalRequest.findFirst({
          where: { id: requestId, companyId: job.companyId },
          select: {
            startsAt: true,
            endsAt: true,
            fulfillmentMode: true,
            client: {
              select: {
                firstName: true,
                middleName: true,
                lastName: true,
                phoneEncrypted: true,
              },
            },
            preferredVehicle: {
              select: { make: true, modelName: true, model: true, registrationNumber: true },
            },
          },
        })
      : null;
    if (!request) return { ...job, payload: { message: 'Заявка уже недоступна.' } };
    return {
      ...job,
      payload: {
        message: formatRentalRequestMessage({
          clientName: personName(request.client),
          clientPhone: decryptedPhone(request.client.phoneEncrypted),
          vehicle: request.preferredVehicle ? vehicleTitle(request.preferredVehicle) : null,
          registrationNumber: request.preferredVehicle?.registrationNumber ?? null,
          startsAt: request.startsAt,
          endsAt: request.endsAt,
          fulfillment:
            request.fulfillmentMode === 'DELIVERY' ? 'Подача по адресу' : 'Получение в офисе',
        }),
        parseMode: 'HTML',
        actions: [
          {
            type: 'open_url',
            label: 'Открыть аренды',
            url: 'https://supapro.ru/rentals',
          },
        ],
      },
    };
  }
  if (job.template === 'CLIENT_IMPOUND_ALERT') {
    const payload =
      typeof job.payload === 'object' && job.payload !== null
        ? (job.payload as Record<string, unknown>)
        : {};
    const rentalId = String(payload.rentalId ?? '');
    const clientId = job.identity?.clientId ?? '';
    const rental =
      rentalId && clientId
        ? await tx.rental.findFirst({
            where: {
              id: rentalId,
              companyId: job.companyId,
              clientId,
              status: { in: ['CONFIRMED', 'ACTIVE'] },
            },
            select: {
              vehicle: {
                select: {
                  make: true,
                  modelName: true,
                  model: true,
                  registrationNumber: true,
                },
              },
            },
          })
        : null;
    if (!rental) {
      return { ...job, payload: { message: 'Уведомление уже недоступно.' } };
    }
    const registration = rental.vehicle.registrationNumber
      ? ` · ${escapeHtml(rental.vehicle.registrationNumber)}`
      : '';
    return {
      ...job,
      payload: {
        message: [
          '🚨 <b>Важное уведомление по автомобилю</b>',
          '',
          '🚗 <b>Авто</b>',
          `└ ${escapeHtml(vehicleTitle(rental.vehicle))}${registration}`,
          '',
          '📍 <b>Событие</b>',
          '└ Автомобиль зафиксирован на территории специализированной стоянки',
          '',
          '⚡ <b>Действие</b>',
          '└ Срочно свяжитесь с офисом СУПА ПРО',
        ].join('\n'),
        parseMode: 'HTML',
        clientMenu: true,
      },
    };
  }
  if (job.template === 'CLIENT_GPS_EVENT') {
    const payload =
      typeof job.payload === 'object' && job.payload !== null
        ? (job.payload as Record<string, unknown>)
        : {};
    const kind = String(payload.kind ?? '');
    const vehicleId = String(payload.vehicleId ?? '');
    const eventId = String(payload.eventId ?? '');
    const rentalId = String(payload.rentalId ?? '');
    const clientId = job.identity?.clientId ?? '';
    if (
      !vehicleId ||
      !eventId ||
      !rentalId ||
      !clientId ||
      (kind !== 'SPEEDING' && kind !== 'HARSH_ACCELERATION' && kind !== 'HARSH_BRAKING')
    ) {
      return { ...job, payload: { message: 'Уведомление уже недоступно.' } };
    }
    const [rental, event] = await Promise.all([
      tx.rental.findFirst({
        where: {
          id: rentalId,
          companyId: job.companyId,
          clientId,
          vehicleId,
          status: { in: ['CONFIRMED', 'ACTIVE'] },
        },
        select: {
          vehicle: {
            select: { make: true, modelName: true, model: true, registrationNumber: true },
          },
        },
      }),
      tx.vehicleEvent.findFirst({
        where: { id: eventId, vehicleId },
        select: { title: true, description: true, recordedAt: true },
      }),
    ]);
    if (!rental || !event) {
      return { ...job, payload: { message: 'Уведомление уже недоступно.' } };
    }
    const mapHref =
      typeof payload.mapHref === 'string' && payload.mapHref.startsWith('/map?')
        ? payload.mapHref
        : `/map?vehicleId=${encodeURIComponent(vehicleId)}&eventId=${encodeURIComponent(eventId)}`;
    const mapUrl = publicAppUrl(mapHref);
    return {
      ...job,
      payload: {
        message: formatClientGpsEvent({
          kind: kind as 'SPEEDING' | 'HARSH_ACCELERATION' | 'HARSH_BRAKING',
          vehicle: vehicleTitle(rental.vehicle),
          registrationNumber: rental.vehicle.registrationNumber,
          eventTitle: event.title,
          eventDescription: event.description,
          eventRecordedAt: event.recordedAt,
        }),
        parseMode: 'HTML',
        clientMenu: true,
        actions: mapUrl ? [{ type: 'map_url', label: '🗺 Карта', url: mapUrl }] : [],
      },
    };
  }
  if (job.template === 'LEAD_CREATED' || job.template === 'LEAD_STATUS_CHANGED') {
    const leadId = leadPayloadId(job.payload, 'leadId');
    const auditId = leadPayloadId(job.payload, 'auditId');
    const [lead, audit] = await Promise.all([
      tx.lead.findFirst({
        where: { id: leadId, companyId: job.companyId },
        select: {
          name: true,
          lastName: true,
          phoneEncrypted: true,
          source: true,
          status: true,
          nextContactAt: true,
          createdAt: true,
          assignedTo: { select: { name: true } },
        },
      }),
      job.template === 'LEAD_STATUS_CHANGED'
        ? tx.auditLog.findFirst({
            where: { id: auditId, companyId: job.companyId },
            select: { changes: true, actorUser: { select: { name: true } } },
          })
        : Promise.resolve(null),
    ]);
    if (!lead) {
      return { ...job, payload: { message: 'Заявка уже недоступна.' } };
    }
    const common = {
      name: lead.name,
      lastName: lead.lastName,
      phone: decryptedPhone(lead.phoneEncrypted),
      source: lead.source,
      nextContactAt: lead.nextContactAt,
      assignedToName: lead.assignedTo?.name ?? null,
      createdAt: lead.createdAt,
      leadsUrl: publicLeadsUrl(),
    };
    const message =
      job.template === 'LEAD_CREATED'
        ? formatLeadCreatedMessage(common)
        : formatLeadStatusChangedMessage({
            ...common,
            actorName: audit?.actorUser?.name ?? null,
            ...leadStatusTransition(audit?.changes, lead.status),
          });
    return {
      ...job,
      payload: {
        message,
        parseMode: 'HTML',
        actions: [{ type: 'open_url', label: 'Открыть заявки', url: publicLeadsUrl() }],
      },
    };
  }
  if (job.template === 'RENTAL_LIFECYCLE' || job.template === 'CLIENT_RENTAL_LIFECYCLE') {
    const customer = job.template === 'CLIENT_RENTAL_LIFECYCLE';
    if (
      customer &&
      (!job.identity?.isActive ||
        job.identity.kind !== 'CLIENT' ||
        !job.identity.clientId ||
        job.identity.companyId !== job.companyId)
    )
      return null;
    const payload =
      typeof job.payload === 'object' && job.payload !== null
        ? (job.payload as Record<string, unknown>)
        : {};
    const kind = String(payload.kind ?? '');
    const rentalId = String(payload.rentalId ?? '');
    const operationId = String(payload.operationId ?? '');
    if (
      !rentalId ||
      !operationId ||
      (kind !== 'HANDOVER' && kind !== 'RETURN' && kind !== 'EXTENSION')
    ) {
      return { ...job, payload: { message: 'Операция аренды уже недоступна.' } };
    }
    const operation = await tx.rentalOperation.findFirst({
      where: {
        id: operationId,
        companyId: job.companyId,
        rentalId,
        status: 'COMMITTED',
        type: kind,
        ...(customer
          ? {
              rental: {
                clientId: job.identity!.clientId!,
                companyId: job.companyId,
                client: { archivedAt: null, status: { notIn: ['BLOCKED', 'ARCHIVED'] } },
              },
            }
          : {}),
      },
      select: {
        type: true,
        occurredAt: true,
        previousEndsAt: true,
        nextEndsAt: true,
        extensionChargeMinor: true,
        mileageKm: true,
        fuelLevelPercent: true,
        actor: { select: { name: true } },
        rental: {
          select: {
            contractNumber: true,
            endsAt: true,
            client: {
              select: {
                firstName: true,
                middleName: true,
                lastName: true,
                phoneEncrypted: true,
              },
            },
            vehicle: {
              select: { make: true, modelName: true, model: true, registrationNumber: true },
            },
          },
        },
      },
    });
    if (kind === 'EXTENSION') {
      if (
        !operation?.rental ||
        !operation.previousEndsAt ||
        !operation.nextEndsAt ||
        operation.extensionChargeMinor == null
      ) {
        return customer
          ? null
          : { ...job, payload: { message: 'Операция продления уже недоступна.' } };
      }
      return {
        ...job,
        payload: {
          parseMode: 'HTML',
          ...(customer ? { clientMenu: true } : {}),
          ...(!customer
            ? {
                actions: [
                  phoneAction(decryptedPhone(operation.rental.client.phoneEncrypted)),
                  publicAppUrl(`/rentals/${encodeURIComponent(rentalId)}`)
                    ? {
                        type: 'contract_url',
                        label: '📄 Договор',
                        url: publicAppUrl(`/rentals/${encodeURIComponent(rentalId)}`),
                      }
                    : null,
                ].filter(Boolean),
              }
            : {}),
          message: formatRentalExtensionMessage({
            vehicle: vehicleTitle(operation.rental.vehicle),
            registrationNumber: operation.rental.vehicle.registrationNumber,
            clientName: personName(operation.rental.client),
            clientPhone: decryptedPhone(operation.rental.client.phoneEncrypted),
            contractNumber: operation.rental.contractNumber,
            actorName: operation.actor.name,
            occurredAt: operation.occurredAt,
            previousEndsAt: operation.previousEndsAt,
            nextEndsAt: operation.nextEndsAt,
            extensionChargeMinor: operation.extensionChargeMinor,
          }),
        },
      };
    }
    if (
      !operation ||
      operation.mileageKm === null ||
      operation.fuelLevelPercent === null ||
      !operation.rental
    ) {
      return customer ? null : { ...job, payload: { message: 'Операция аренды уже недоступна.' } };
    }
    const handover =
      kind === 'RETURN'
        ? await tx.rentalOperation.findFirst({
            where: {
              companyId: job.companyId,
              rentalId,
              type: 'HANDOVER',
              status: 'COMMITTED',
            },
            select: { mileageKm: true, fuelLevelPercent: true },
            orderBy: { occurredAt: 'desc' },
          })
        : null;
    return {
      ...job,
      payload: {
        message:
          formatRentalLifecycleMessage({
            kind,
            occurredAt: operation.occurredAt,
            contractNumber: operation.rental.contractNumber,
            vehicle: vehicleTitle(operation.rental.vehicle),
            registrationNumber: operation.rental.vehicle.registrationNumber,
            clientName: personName(operation.rental.client),
            clientPhone: decryptedPhone(operation.rental.client.phoneEncrypted),
            actorName: operation.actor.name,
            mileageKm: operation.mileageKm,
            fuelLevelPercent: operation.fuelLevelPercent,
            handoverMileageKm: handover?.mileageKm,
            handoverFuelLevelPercent: handover?.fuelLevelPercent,
          }) +
          (customer && kind === 'HANDOVER'
            ? `\n📅 Возврат: ${new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' }).format(operation.rental.endsAt)} (МСК)`
            : ''),
        parseMode: 'HTML',
        ...(customer ? { clientMenu: true } : {}),
        ...(!customer
          ? {
              actions: [
                phoneAction(decryptedPhone(operation.rental.client.phoneEncrypted)),
                publicAppUrl(`/rentals/${encodeURIComponent(rentalId)}`)
                  ? {
                      type: 'contract_url',
                      label: '📄 Договор',
                      url: publicAppUrl(`/rentals/${encodeURIComponent(rentalId)}`),
                    }
                  : null,
              ].filter(Boolean),
            }
          : {}),
      },
    };
  }
  if (job.template === 'OPERATIONAL_ALERT') {
    const payload =
      typeof job.payload === 'object' && job.payload !== null
        ? (job.payload as Record<string, unknown>)
        : {};
    const kind = String(payload.kind ?? '');
    const vehicleId = String(payload.vehicleId ?? '');
    const rentalId = payload.rentalId ? String(payload.rentalId) : null;
    const eventId = payload.eventId ? String(payload.eventId) : null;
    const fineId = payload.fineId ? String(payload.fineId) : null;
    const impoundLotId = payload.impoundLotId ? String(payload.impoundLotId) : null;
    const impoundLot = IMPOUND_LOTS.find((lot) => lot.id === impoundLotId) ?? null;
    const allowedKinds = new Set([
      'RENTED_GPS_WARNING',
      'RENTED_GPS_CRITICAL',
      'RENTED_GPS_THEFT_RISK',
      'FREE_GPS_TRACKER_PROBLEM',
      'RETURN_SOON',
      'RETURN_OVERDUE',
      'GEOFENCE_EXIT',
      'SPEEDING',
      'NEW_FINE',
      'LOW_FUEL',
      'BORDER_APPROACH',
      'FUEL_STATION_VISIT',
      'IMPOUND_LOT_ENTRY',
      'SERVICE_CENTER_ARRIVAL',
      'HARSH_ACCELERATION',
      'HARSH_BRAKING',
    ]);
    if (!vehicleId || !allowedKinds.has(kind)) {
      return { ...job, payload: { message: 'Оперативное событие уже недоступно.' } };
    }
    const [vehicle, rental, event, fine] = await Promise.all([
      tx.vehicle.findFirst({
        where: { id: vehicleId, companyId: job.companyId },
        select: {
          make: true,
          modelName: true,
          model: true,
          registrationNumber: true,
          positions: {
            where: { provider: 'GLONASSSOFT' },
            select: { recordedAt: true },
            orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
            take: 1,
          },
        },
      }),
      rentalId
        ? tx.rental.findFirst({
            where: { id: rentalId, companyId: job.companyId },
            select: {
              endsAt: true,
              client: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  phoneEncrypted: true,
                },
              },
            },
          })
        : tx.rental.findFirst({
            where: {
              companyId: job.companyId,
              vehicleId,
              status: { in: ['CONFIRMED', 'ACTIVE'] },
              startsAt: { lte: now },
              endsAt: { gte: now },
            },
            orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
            select: {
              endsAt: true,
              client: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  phoneEncrypted: true,
                },
              },
            },
          }),
      eventId
        ? tx.vehicleEvent.findFirst({
            where: { id: eventId, vehicleId },
            select: { title: true, description: true, recordedAt: true },
          })
        : Promise.resolve(null),
      fineId
        ? tx.fine.findFirst({
            where: { id: fineId, companyId: job.companyId },
            select: {
              decreeNumber: true,
              currentAmountMinor: true,
              articleCode: true,
              description: true,
              offenseAt: true,
              clientId: true,
              client: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  phoneEncrypted: true,
                },
              },
            },
          })
        : Promise.resolve(null),
    ]);
    if (!vehicle) {
      return { ...job, payload: { message: 'Автомобиль уже недоступен.' } };
    }
    const lastSignalAt = vehicle.positions[0]?.recordedAt ?? null;
    const clientPhone = rental
      ? decryptedPhone(rental.client.phoneEncrypted)
      : fine?.client
        ? decryptedPhone(fine.client.phoneEncrypted)
        : null;
    const mapHref =
      typeof payload.mapHref === 'string' && payload.mapHref.startsWith('/map?')
        ? payload.mapHref
        : `/map?vehicleId=${encodeURIComponent(vehicleId)}`;
    const mapUrl = publicAppUrl(mapHref);
    const fineUrl = fineId ? publicAppUrl(`/fines?fineId=${encodeURIComponent(fineId)}`) : null;
    const rentalUrl = rentalId ? publicAppUrl(`/rentals/${encodeURIComponent(rentalId)}`) : null;
    const fineAmountLabel = fine
      ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(
          Number(fine.currentAmountMinor) / 100,
        )
      : null;
    const actions = (
      kind === 'NEW_FINE'
        ? [
            phoneAction(clientPhone),
            fineUrl
              ? { type: 'decree_url', label: '📥 Скачать постановление', url: fineUrl }
              : null,
            fineUrl && fineAmountLabel
              ? { type: 'payment_url', label: `💳 Оплатить ${fineAmountLabel} ₽`, url: fineUrl }
              : null,
          ]
        : kind === 'RETURN_SOON' || kind === 'RETURN_OVERDUE'
          ? [
              phoneAction(clientPhone),
              rentalId ? { type: 'remind', label: '🔔 Напомнить', actionId: rentalId } : null,
            ]
          : kind === 'IMPOUND_LOT_ENTRY'
            ? [
                rentalId
                  ? { type: 'notify_client', label: '✉️ Сообщить', actionId: rentalId }
                  : null,
                phoneAction(clientPhone),
                mapUrl ? { type: 'map_url', label: '🗺 Карта', url: mapUrl } : null,
              ]
            : [
                phoneAction(clientPhone),
                mapUrl ? { type: 'map_url', label: '🗺 Карта', url: mapUrl } : null,
                rentalUrl ? { type: 'contract_url', label: '📄 Договор', url: rentalUrl } : null,
              ]
    ).filter(Boolean);
    return {
      ...job,
      payload: {
        message: formatOperationalAlertForAudience(
          {
            kind: kind as Parameters<typeof formatOperationalAlertForAudience>[0]['kind'],
            vehicle: vehicleTitle(vehicle),
            registrationNumber: vehicle.registrationNumber,
            silentForMs: lastSignalAt ? now.getTime() - lastSignalAt.getTime() : null,
            clientName: rental
              ? personName(rental.client)
              : fine?.client
                ? personName(fine.client)
                : null,
            clientPhone,
            rentalEndsAt: rental?.endsAt ?? null,
            eventTitle: event?.title ?? null,
            eventDescription: event?.description ?? null,
            eventRecordedAt:
              typeof payload.recordedAt === 'string'
                ? new Date(payload.recordedAt)
                : (event?.recordedAt ?? null),
            fineAmountMinor: fine?.currentAmountMinor.toString() ?? null,
            fineDecreeNumber: fine?.decreeNumber ?? null,
            fineArticle: fine?.articleCode ?? null,
            fineDescription: fine?.description ?? null,
            fineOffenseAt: fine?.offenseAt ?? null,
            fineAttributedToClient: Boolean(fine?.clientId),
            fuelLevelPercent: numberOrNull(payload.fuelLevelPercent),
            borderCountry: typeof payload.borderCountry === 'string' ? payload.borderCountry : null,
            borderDistanceKm: numberOrNull(payload.borderDistanceKm),
            stationLabel: typeof payload.stationLabel === 'string' ? payload.stationLabel : null,
            impoundCity: impoundLot?.city ?? null,
            impoundAddress: impoundLot?.address ?? null,
            serviceAddress:
              typeof payload.serviceAddress === 'string' ? payload.serviceAddress : null,
          },
          'MANAGER',
        ),
        parseMode: 'HTML',
        actions,
      },
    };
  }
  if (job.template === 'DAILY_UNPAID_FINES') {
    const date =
      typeof job.payload === 'object' && job.payload !== null && 'date' in job.payload
        ? String(job.payload.date)
        : undefined;
    const range = moscowDayRange(date);
    const fines = await tx.fine.findMany({
      where: {
        companyId: job.companyId,
        status: { in: ['NEW', 'UNPAID', 'OVERDUE'] },
      },
      orderBy: [{ offenseAt: 'desc' }, { id: 'desc' }],
      take: 500,
      select: {
        decreeNumber: true,
        offenseAt: true,
        discountExpiresAt: true,
        originalAmountMinor: true,
        currentAmountMinor: true,
        articleCode: true,
        description: true,
        status: true,
        client: { select: { lastName: true } },
        vehicle: {
          select: { make: true, modelName: true, model: true, registrationNumber: true },
        },
      },
    });
    const sortedFines = [...fines].sort((left, right) => {
      const leftDeadline = left.discountExpiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightDeadline = right.discountExpiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (leftDeadline !== rightDeadline) return leftDeadline - rightDeadline;
      return right.offenseAt.getTime() - left.offenseAt.getTime();
    });
    return {
      ...job,
      payload: {
        message: formatUnpaidFinesReport(
          range.date,
          sortedFines.map((fine) => ({
            decreeNumber: fine.decreeNumber,
            clientLastName: fine.client?.lastName ?? null,
            vehicle: fine.vehicle ? vehicleTitle(fine.vehicle) : 'Автомобиль не определён',
            registrationNumber: fine.vehicle?.registrationNumber ?? null,
            violation:
              fine.description?.trim() || fine.articleCode?.trim() || 'Нарушение не указано',
            originalAmountMinor: fine.originalAmountMinor.toString(),
            currentAmountMinor: fine.currentAmountMinor.toString(),
            offenseAt: fine.offenseAt,
            discountExpiresAt: fine.discountExpiresAt,
            status:
              fine.status === 'OVERDUE' ? 'OVERDUE' : fine.status === 'NEW' ? 'NEW' : 'UNPAID',
          })),
        ),
        parseMode: 'HTML',
      },
    };
  }
  if (job.template === 'DAILY_OPERATIONS_DIGEST') {
    const date =
      typeof job.payload === 'object' && job.payload !== null && 'date' in job.payload
        ? String(job.payload.date)
        : undefined;
    const range = moscowDayRange(date);
    const requestedPart =
      typeof job.payload === 'object' &&
      job.payload !== null &&
      'part' in job.payload &&
      ['critical', 'trackers', 'totals'].includes(String(job.payload.part))
        ? (String(job.payload.part) as 'critical' | 'trackers' | 'totals')
        : 'critical';
    const previousRange = {
      start: new Date(range.start.getTime() - 24 * 60 * 60_000),
      end: range.start,
    };
    const isMonday = new Date(range.start.getTime() + 3 * 60 * 60_000).getUTCDay() === 1;
    const weekRange = {
      start: new Date(range.start.getTime() - 7 * 24 * 60 * 60_000),
      end: range.start,
    };
    const overlap = { startsAt: { lt: range.end }, endsAt: { gt: range.start } };
    const [
      requests,
      rentals,
      dayRentals,
      vehicles,
      depositReturns,
      maintenance,
      washes,
      leads,
      yesterdayRentals,
      yesterdayIncidents,
      weeklyRentals,
    ] = await Promise.all([
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
          ...overlap,
        },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        take: 200,
        select: {
          startsAt: true,
          endsAt: true,
          contractNumber: true,
          client: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
              phoneEncrypted: true,
            },
          },
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
        where: { companyId: job.companyId, archivedAt: null, isDemoImport: false },
        select: {
          status: true,
          isDemoImport: true,
          make: true,
          modelName: true,
          model: true,
          registrationNumber: true,
          rentals: {
            where: { status: { in: ['CONFIRMED', 'ACTIVE'] }, ...overlap },
            select: { id: true, status: true },
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
          positions: {
            where: { provider: 'GLONASSSOFT' },
            select: { recordedAt: true },
            orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
            take: 1,
          },
        },
        take: 300,
      }),
      tx.rentalOperation.findMany({
        where: {
          companyId: job.companyId,
          status: 'COMMITTED',
          type: 'RETURN',
          depositStatus: 'COLLECTED',
          occurredAt: { gte: range.start, lt: range.end },
        },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        take: 200,
        select: {
          occurredAt: true,
          depositAmountMinor: true,
          rental: {
            select: {
              contractNumber: true,
              depositMinor: true,
              client: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  phoneEncrypted: true,
                },
              },
              vehicle: {
                select: {
                  make: true,
                  modelName: true,
                  model: true,
                  registrationNumber: true,
                },
              },
            },
          },
        },
      }),
      tx.maintenanceRecord.findMany({
        where: {
          vehicle: { companyId: job.companyId, archivedAt: null, isDemoImport: false },
          status: { in: ['PLANNED', 'IN_PROGRESS', 'OVERDUE'] },
          scheduledAt: { gte: range.start, lt: range.end },
        },
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        take: 200,
        select: {
          scheduledAt: true,
          title: true,
          status: true,
          vehicle: {
            select: { make: true, modelName: true, model: true, registrationNumber: true },
          },
        },
      }),
      tx.washRecord.findMany({
        where: {
          vehicle: { companyId: job.companyId, archivedAt: null, isDemoImport: false },
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
          scheduledAt: { gte: range.start, lt: range.end },
        },
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        take: 200,
        select: {
          scheduledAt: true,
          kind: true,
          status: true,
          vehicle: {
            select: { make: true, modelName: true, model: true, registrationNumber: true },
          },
        },
      }),
      tx.lead.findMany({
        where: {
          companyId: job.companyId,
          status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] },
          nextContactAt: { gte: range.start, lt: range.end },
        },
        orderBy: [{ nextContactAt: 'asc' }, { id: 'asc' }],
        take: 200,
        select: {
          name: true,
          lastName: true,
          source: true,
          phoneEncrypted: true,
          nextContactAt: true,
        },
      }),
      tx.rental.findMany({
        where: {
          companyId: job.companyId,
          status: 'COMPLETED',
          completedAt: { gte: previousRange.start, lt: previousRange.end },
        },
        select: { totalPriceMinor: true, startsAt: true, endsAt: true },
        take: 500,
      }),
      tx.vehicleEvent.count({
        where: {
          vehicle: { companyId: job.companyId },
          severity: 'DANGER',
          recordedAt: { gte: previousRange.start, lt: previousRange.end },
        },
      }),
      isMonday
        ? tx.rental.findMany({
            where: {
              companyId: job.companyId,
              status: 'COMPLETED',
              completedAt: { gte: weekRange.start, lt: weekRange.end },
            },
            select: { totalPriceMinor: true, startsAt: true, endsAt: true },
            take: 1000,
          })
        : Promise.resolve([]),
    ]);
    const freeVehicles = vehicles.filter(
      (vehicle) =>
        vehicle.status !== 'MAINTENANCE' &&
        !vehicle.rentals.length &&
        !vehicle.maintenanceRecords.length,
    );
    const rentalItem = (rental: (typeof dayRentals)[number], at: Date, title: string) => ({
      at,
      title,
      contractNumber: rental.contractNumber,
      vehicle: vehicleTitle(rental.vehicle),
      registrationNumber: rental.vehicle.registrationNumber,
      client: personName(rental.client),
      phone: decryptedPhone(rental.client.phoneEncrypted),
    });
    const washTitles: Record<string, string> = {
      BODY: 'Мойка кузова',
      INTERIOR: 'Уборка салона',
      COMPLEX: 'Комплексная мойка',
    };
    const rentedVehicles = vehicles.filter((vehicle) => vehicle.rentals.length > 0);
    const bookedVehicles = vehicles.filter((vehicle) => vehicle.rentals[0]?.status === 'CONFIRMED');
    const maintenanceVehicles = vehicles.filter(
      (vehicle) => vehicle.status === 'MAINTENANCE' || vehicle.maintenanceRecords.length > 0,
    );
    const unknownVehicles = vehicles.filter((vehicle) => vehicle.status === 'UNKNOWN');
    const previousRevenueMinor = yesterdayRentals.reduce(
      (total, rental) => total + rental.totalPriceMinor,
      BigInt(0),
    );
    const fleetLoad = vehicles.length
      ? Math.round((rentedVehicles.length / vehicles.length) * 100)
      : 0;
    const problemRows = vehicles.flatMap((vehicle) => {
      const lastSignalAt = vehicle.positions[0]?.recordedAt ?? null;
      const silentForMs = lastSignalAt
        ? Math.max(0, now.getTime() - lastSignalAt.getTime())
        : 365 * 24 * 60 * 60_000;
      const kind = classifyGpsSilence({
        isRented: vehicle.rentals.length > 0,
        silentForMs,
      });
      if (!kind) return [];
      const hours = Math.floor(silentForMs / (60 * 60_000));
      const duration = `${Math.floor(hours / 24)} дн. ${hours % 24} ч.`;
      return [
        {
          kind,
          vehicle: vehicleTitle(vehicle),
          registrationNumber: vehicle.registrationNumber,
          details: `Нет связи ${duration}`,
          action:
            kind === 'FREE_GPS_TRACKER_PROBLEM'
              ? 'Проверить АКБ, питание и SIM-карту трекера.'
              : kind === 'RENTED_GPS_THEFT_RISK'
                ? 'Срочно позвонить клиенту. Возможен угон или работа глушилки.'
                : 'Позвонить клиенту и уточнить местоположение.',
        },
      ];
    });
    const recommendations = [
      ...problemRows.slice(0, 3).map((problem) => problem.action),
      ...(leads.length ? [`Обработать ${leads.length} запланированных заявок.`] : []),
      ...(maintenance.some((record) => record.status === 'OVERDUE')
        ? ['Закрыть просроченное техническое обслуживание.']
        : []),
    ];
    const digestParts = formatOperationsDigestParts({
      date: range.date,
      requests,
      activeRentals: rentals,
      yesterday: {
        revenueMinor: previousRevenueMinor.toString(),
        completedRentals: yesterdayRentals.length,
        incidents: yesterdayIncidents,
        loadPercent: fleetLoad,
      },
      fleet: {
        rented: rentedVehicles.length,
        free: freeVehicles.length,
        booked: bookedVehicles.length,
        maintenance: maintenanceVehicles.length,
        unknown: unknownVehicles.length,
        total: vehicles.length,
      },
      criticalProblems: problemRows.filter(
        (problem) =>
          problem.kind === 'RENTED_GPS_CRITICAL' || problem.kind === 'RENTED_GPS_THEFT_RISK',
      ),
      trackerProblems: problemRows.filter(
        (problem) =>
          problem.kind === 'RENTED_GPS_WARNING' || problem.kind === 'FREE_GPS_TRACKER_PROBLEM',
      ),
      leads: leads.map((lead) => ({
        at: lead.nextContactAt,
        name: [lead.lastName, lead.name].filter(Boolean).join(' '),
        source: lead.source,
        phone: decryptedPhone(lead.phoneEncrypted),
        overdue: Boolean(lead.nextContactAt && lead.nextContactAt < now),
      })),
      recommendations,
      weekly:
        isMonday && weeklyRentals.length
          ? {
              startDate: weekRange.start.toISOString().slice(0, 10),
              endDate: new Date(weekRange.end.getTime() - 1).toISOString().slice(0, 10),
              revenueMinor: weeklyRentals
                .reduce((total, rental) => total + rental.totalPriceMinor, BigInt(0))
                .toString(),
              rentals: weeklyRentals.length,
              averageDurationDays: Number(
                (
                  weeklyRentals.reduce(
                    (total, rental) =>
                      total +
                      (rental.endsAt.getTime() - rental.startsAt.getTime()) / (24 * 60 * 60_000),
                    0,
                  ) / weeklyRentals.length
                ).toFixed(1),
              ),
              loadPercent: fleetLoad,
            }
          : undefined,
      handovers: dayRentals
        .filter((rental) => rental.startsAt >= range.start && rental.startsAt < range.end)
        .map((rental) => rentalItem(rental, rental.startsAt, 'Выдать автомобиль')),
      returns: dayRentals
        .filter((rental) => rental.endsAt >= range.start && rental.endsAt < range.end)
        .map((rental) => rentalItem(rental, rental.endsAt, 'Принять возврат автомобиля')),
      deposits: depositReturns.map((operation) => ({
        at: operation.occurredAt,
        title: 'Вернуть депозит',
        contractNumber: operation.rental.contractNumber,
        vehicle: vehicleTitle(operation.rental.vehicle),
        registrationNumber: operation.rental.vehicle.registrationNumber,
        client: personName(operation.rental.client),
        phone: decryptedPhone(operation.rental.client.phoneEncrypted),
        amountMinor:
          (operation.depositAmountMinor ?? operation.rental.depositMinor)?.toString() ?? null,
      })),
      washes: washes.flatMap((wash) =>
        wash.scheduledAt
          ? [
              {
                at: wash.scheduledAt,
                title: washTitles[wash.kind] ?? 'Мойка автомобиля',
                vehicle: vehicleTitle(wash.vehicle),
                registrationNumber: wash.vehicle.registrationNumber,
              },
            ]
          : [],
      ),
      maintenance: maintenance.flatMap((record) =>
        record.scheduledAt
          ? [
              {
                at: record.scheduledAt,
                title: record.title,
                vehicle: vehicleTitle(record.vehicle),
                registrationNumber: record.vehicle.registrationNumber,
                overdue: record.status === 'OVERDUE' || record.scheduledAt < now,
              },
            ]
          : [],
      ),
      offlineVehicles: vehicles.flatMap((vehicle) => {
        const lastSignalAt = vehicle.positions[0]?.recordedAt ?? null;
        return !lastSignalAt || now.getTime() - lastSignalAt.getTime() > OFFLINE_AFTER_MS
          ? [
              {
                vehicle: vehicleTitle(vehicle),
                registrationNumber: vehicle.registrationNumber,
                lastSignalAt,
              },
            ]
          : [];
      }),
      freeVehicles: freeVehicles.map((vehicle) => ({
        vehicle: vehicleTitle(vehicle),
        registrationNumber: vehicle.registrationNumber,
      })),
    });
    const selected = digestParts.find((part) => part.key === requestedPart) ?? digestParts[0];
    const actions =
      selected.key === 'critical'
        ? [
            {
              type: 'summary_section',
              label: '🟠 Трекеры и GPS',
              section: 'trackers',
              date: range.date,
            },
          ]
        : selected.key === 'trackers'
          ? [
              {
                type: 'summary_section',
                label: '📊 Итоги и возвраты',
                section: 'totals',
                date: range.date,
              },
            ]
          : [{ type: 'summary_refresh', label: '🔄 Обновить сводку', date: range.date }];
    return {
      ...job,
      payload: {
        message: selected.message,
        parseMode: 'HTML',
        actions,
        digestDate: range.date,
        digestParts: Object.fromEntries(
          digestParts.map((part) => [
            part.key,
            {
              message: part.message,
              actions:
                part.key === 'critical'
                  ? [
                      {
                        type: 'summary_section',
                        label: '🟠 Трекеры и GPS',
                        section: 'trackers',
                        date: range.date,
                      },
                    ]
                  : part.key === 'trackers'
                    ? [
                        {
                          type: 'summary_section',
                          label: '📊 Итоги и возвраты',
                          section: 'totals',
                          date: range.date,
                        },
                      ]
                    : [
                        {
                          type: 'summary_refresh',
                          label: '🔄 Обновить сводку',
                          date: range.date,
                        },
                      ],
            },
          ]),
        ),
      },
    };
  }
  if (job.template !== 'RENTAL_RETURN_STAFF' && job.template !== 'RENTAL_RETURN_CLIENT') return job;
  const clientReminder = job.template === 'RENTAL_RETURN_CLIENT';
  if (
    clientReminder &&
    (!job.identity?.isActive ||
      job.identity.kind !== 'CLIENT' ||
      !job.identity.clientId ||
      job.identity.companyId !== job.companyId)
  )
    return null;
  const reminderPayload =
    typeof job.payload === 'object' && job.payload !== null
      ? (job.payload as Record<string, unknown>)
      : {};
  const manualReminder = reminderPayload.manual === true;
  const rentalId =
    typeof job.payload === 'object' && job.payload !== null && 'rentalId' in job.payload
      ? String(job.payload.rentalId)
      : '';
  const rental = await tx.rental.findFirst({
    where: {
      id: rentalId,
      companyId: job.companyId,
      status: { in: ['CONFIRMED', 'ACTIVE'] },
      ...(clientReminder
        ? {
            clientId: job.identity!.clientId!,
            client: { archivedAt: null, status: { notIn: ['BLOCKED', 'ARCHIVED'] } },
          }
        : {}),
    },
    select: {
      contractNumber: true,
      endsAt: true,
      client: { select: { firstName: true, middleName: true, phoneEncrypted: true } },
      vehicle: { select: { make: true, modelName: true, model: true, registrationNumber: true } },
    },
  });
  if (!rental) return null;
  const stage = returnReminderStage(now, rental.endsAt);
  if (
    clientReminder &&
    !manualReminder &&
    (!stage ||
      reminderPayload.endsAt !== rental.endsAt.toISOString() ||
      reminderPayload.stage !== stage)
  )
    return null;
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
        message: formatClientReturnReminderMessage({
          stage,
          manual: manualReminder,
          vehicle: vehicleTitle(rental.vehicle),
          registrationNumber: rental.vehicle.registrationNumber,
          contractNumber: rental.contractNumber,
          endsAt: rental.endsAt,
        }),
        parseMode: 'HTML',
        clientMenu: true,
      },
    };
  const key = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  const phone =
    key && rental.client.phoneEncrypted
      ? decryptField(rental.client.phoneEncrypted, key)
      : 'нет телефона';
  const name = `${rental.client.firstName} ${rental.client.middleName ?? ''}`.trim();
  return {
    ...job,
    payload: {
      message: formatTomorrowReturnMessage({
        vehicle: vehicleTitle(rental.vehicle),
        registrationNumber: rental.vehicle.registrationNumber,
        clientName: name,
        clientPhone: phone === 'нет телефона' ? null : phone,
        contractNumber: rental.contractNumber,
        endsAt: rental.endsAt,
      }),
      parseMode: 'HTML',
      actions: [{ type: 'remind', label: '🔔 Напомнить', actionId: rentalId }],
    },
  };
}

export async function claimNotificationJobs(
  now: Date,
  workerId: string,
  database: ClaimDb = prisma,
  audience: 'ALL' | 'CLIENT' | 'STAFF' = 'ALL',
) {
  if (!/^[A-Za-z0-9_-]{1,64}$/u.test(workerId)) throw new BotApiError('INVALID_REQUEST', 400);
  return database.$transaction(
    async (tx) => {
      const candidates = await tx.botNotificationJob.findMany({
        where: {
          availableAt: { lte: now },
          attempts: { lt: 5 },
          AND: [
            {
              OR: [
                { status: { in: ['PENDING', 'ERROR'] }, claimToken: null },
                { status: 'PROCESSING', leaseExpiresAt: { lt: now } },
              ],
            },
            ...(audience === 'CLIENT'
              ? [{ identity: { is: { kind: 'CLIENT' as const, isActive: true } } }]
              : audience === 'STAFF'
                ? [
                    {
                      OR: [
                        { identityId: null },
                        { identity: { is: { kind: 'STAFF' as const, isActive: true } } },
                      ],
                    },
                  ]
                : []),
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
            identity: {
              select: {
                telegramUserId: true,
                isActive: true,
                clientId: true,
                companyId: true,
                kind: true,
              },
            },
          },
        });
        if (job) {
          const binding = job.identity
            ? null
            : await tx.telegramGroupBinding.findUnique({
                where: { companyId: job.companyId },
                select: { telegramChatId: true },
              });
          const destination = notificationDestination(job, binding?.telegramChatId ?? null);
          const hydrated = destination
            ? await hydrateJob(tx, now, {
                ...job,
                chatId: job.identity ? null : destination,
              })
            : null;
          if (hydrated) claimed.push(hydrated);
          else
            await tx.botNotificationJob.updateMany({
              where: { id: job.id, claimToken: job.claimToken, status: 'PROCESSING' },
              data: {
                status: 'CANCELLED',
                claimToken: null,
                leaseExpiresAt: null,
                lastErrorCode: 'SUPERSEDED_OR_ACCESS_REVOKED',
              },
            });
        }
      }
      return claimed;
    },
    { timeout: 30_000 },
  );
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
