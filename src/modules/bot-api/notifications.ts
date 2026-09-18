import { randomUUID } from 'node:crypto';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import {
  isCompleteWeeklyInspection,
  moscowWeekRange,
  weeklyInspectionRequiredMedia,
} from '@/modules/rentals/lease-to-own/weekly-inspection';
import { isLowFuelLevel, LOW_FUEL_THRESHOLD_PERCENT } from '@/modules/vehicles/fuel-level';
import { OFFLINE_AFTER_MS } from '@/modules/vehicles/gps-status';
import { decryptField } from '@/services/security/field-encryption';

import { BotApiError } from './auth';
import { moscowDayRange } from './daily-operations';
import { formatLeadCreatedMessage, formatLeadStatusChangedMessage } from './lead-notifications';
import {
  classifyGpsSilence,
  classifyRentalDeadline,
  formatOperationalAlert,
} from './operational-alerts';
import { formatOperationsDigest } from './operations-digest';
import { formatRentalLifecycleMessage } from './rental-lifecycle-notifications';
import { formatUnpaidFinesReport } from './unpaid-fines-report';

type ClaimDb = Pick<typeof prisma, '$transaction'>;
type UpdateDb = Pick<typeof prisma, 'botNotificationJob'>;
const LEASE_MS = 60_000;

function vehicleTitle(vehicle: { make: string | null; modelName: string | null; model: string }) {
  return `${vehicle.make ?? ''} ${vehicle.modelName ?? vehicle.model}`.trim();
}

function personName(person: { firstName: string; middleName: string | null; lastName: string }) {
  return [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ');
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

export async function enqueueDailyOperationsDigests(now: Date, database = prisma) {
  const moscow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  if (moscow.getUTCHours() !== 8 || moscow.getUTCMinutes() >= 15) return 0;
  const date = moscow.toISOString().slice(0, 10);
  const bindings = await database.telegramGroupBinding.findMany({
    select: { companyId: true, telegramChatId: true, boundByUserId: true },
    take: 500,
  });
  if (!bindings.length) return 0;
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
  const rows: Prisma.BotNotificationJobCreateManyInput[] = bindings.flatMap((binding) => {
    const operationsCommon = {
      companyId: binding.companyId,
      template: 'DAILY_OPERATIONS_DIGEST',
      payload: { date },
      availableAt: now,
    };
    const finesCommon = {
      companyId: binding.companyId,
      template: 'DAILY_UNPAID_FINES',
      payload: { date },
      availableAt: now,
    };
    const operationsGroup = {
      ...operationsCommon,
      chatId: binding.telegramChatId,
      eventKey: `daily-operations:${binding.companyId}:${date}:group`,
    };
    const finesGroup = {
      ...finesCommon,
      chatId: binding.telegramChatId,
      eventKey: `daily-unpaid-fines:${binding.companyId}:${date}:group`,
    };
    const identityId = identityByBinding.get(`${binding.companyId}:${binding.boundByUserId}`);
    return identityId
      ? [
          operationsGroup,
          {
            ...operationsCommon,
            identityId,
            eventKey: `daily-operations:${binding.companyId}:${date}:staff:${identityId}`,
          },
          finesGroup,
          {
            ...finesCommon,
            identityId,
            eventKey: `daily-unpaid-fines:${binding.companyId}:${date}:staff:${identityId}`,
          },
        ]
      : [operationsGroup, finesGroup];
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
      const vehicle = [
        rental.vehicle.make,
        rental.vehicle.modelName ?? rental.vehicle.model,
        rental.vehicle.registrationNumber,
      ]
        .filter(Boolean)
        .join(' ');
      const client = [
        rental.client.lastName,
        rental.client.firstName,
        rental.client.middleName,
      ]
        .filter(Boolean)
        .join(' ');
      rows.push({
        companyId: rental.companyId,
        chatId: binding.telegramChatId,
        template: 'LEASE_TO_OWN_WEEKLY_INSPECTION',
        eventKey: `lease-to-own-inspection:${rental.companyId}:${rental.id}:${week.weekKey}:group`,
        availableAt: now,
        payload: {
          message: [
            '📸 Аренда с правом выкупа — еженедельный контроль',
            `${client} · ${vehicle}`,
            `Договор: ${rental.contractNumber ?? 'без номера'}`,
            `Нужно загрузить: фото приборки, кузов с 4 сторон и видео.`,
            `https://supapro.ru/rentals/${rental.id}?action=weekly-inspection#rental-actions`,
          ].join('\n'),
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

export async function enqueueOperationalAlerts(now: Date, database = prisma) {
  if (now.getUTCMinutes() % 15 !== 0 || now.getUTCSeconds() >= 10) return 0;
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

  const lowFuelAlerts = await Promise.all(
    vehicles.map(async (vehicle): Promise<Alert | null> => {
      const currentPosition = vehicle.positions[0] ?? null;
      const currentOperation = vehicle.rentalOperations?.[0] ?? null;
      const positionFuel = numberOrNull(currentPosition?.fuelLevelPercent);
      const operationFuel = numberOrNull(currentOperation?.fuelLevelPercent);
      const fuelLevelPercent = positionFuel ?? operationFuel;
      if (!isLowFuelLevel(fuelLevelPercent)) return null;

      if (positionFuel !== null && currentPosition) {
        const lastRecoveredPosition = await database.vehiclePosition.findFirst({
          where: {
            vehicleId: vehicle.id,
            provider: 'GLONASSSOFT',
            fuelLevelPercent: { gt: LOW_FUEL_THRESHOLD_PERCENT },
            recordedAt: { lt: currentPosition.recordedAt },
          },
          select: { id: true },
          orderBy: [{ recordedAt: 'desc' as const }, { id: 'desc' as const }],
        });
        return {
          companyId: vehicle.companyId,
          eventKey: `fuel:${vehicle.id}:position:${lastRecoveredPosition?.id ?? 'initial'}`,
          payload: {
            kind: 'LOW_FUEL',
            vehicleId: vehicle.id,
            fuelLevelPercent: Math.round(fuelLevelPercent as number),
          },
        };
      }

      const lastRecoveredOperation = await database.rentalOperation.findFirst({
        where: {
          companyId: vehicle.companyId,
          vehicleId: vehicle.id,
          status: 'COMMITTED',
          fuelLevelPercent: { gt: LOW_FUEL_THRESHOLD_PERCENT },
          occurredAt: { lt: currentOperation?.occurredAt ?? now },
        },
        select: { id: true },
        orderBy: [{ occurredAt: 'desc' as const }, { id: 'desc' as const }],
      });
      return {
        companyId: vehicle.companyId,
        eventKey: `fuel:${vehicle.id}:operation:${lastRecoveredOperation?.id ?? 'initial'}`,
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
  const result = await database.botNotificationJob.createMany({ data: rows, skipDuplicates: true });
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
  now: Date,
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
    return { ...job, payload: { message, parseMode: 'HTML' } };
  }
  if (job.template === 'RENTAL_LIFECYCLE') {
    const payload =
      typeof job.payload === 'object' && job.payload !== null
        ? (job.payload as Record<string, unknown>)
        : {};
    const kind = String(payload.kind ?? '');
    const rentalId = String(payload.rentalId ?? '');
    const operationId = String(payload.operationId ?? '');
    if (!rentalId || !operationId || (kind !== 'HANDOVER' && kind !== 'RETURN')) {
      return { ...job, payload: { message: 'Операция аренды уже недоступна.' } };
    }
    const operation = await tx.rentalOperation.findFirst({
      where: {
        id: operationId,
        companyId: job.companyId,
        rentalId,
        status: 'COMMITTED',
        type: kind,
      },
      select: {
        type: true,
        occurredAt: true,
        mileageKm: true,
        fuelLevelPercent: true,
        actor: { select: { name: true } },
        rental: {
          select: {
            contractNumber: true,
            client: { select: { firstName: true, middleName: true, lastName: true } },
            vehicle: {
              select: { make: true, modelName: true, model: true, registrationNumber: true },
            },
          },
        },
      },
    });
    if (
      !operation ||
      operation.mileageKm === null ||
      operation.fuelLevelPercent === null ||
      !operation.rental
    ) {
      return { ...job, payload: { message: 'Операция аренды уже недоступна.' } };
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
        message: formatRentalLifecycleMessage({
          kind,
          occurredAt: operation.occurredAt,
          contractNumber: operation.rental.contractNumber,
          vehicle: vehicleTitle(operation.rental.vehicle),
          registrationNumber: operation.rental.vehicle.registrationNumber,
          clientName: personName(operation.rental.client),
          actorName: operation.actor.name,
          mileageKm: operation.mileageKm,
          fuelLevelPercent: operation.fuelLevelPercent,
          handoverMileageKm: handover?.mileageKm,
          handoverFuelLevelPercent: handover?.fuelLevelPercent,
        }),
        parseMode: 'HTML',
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
              currentAmountMinor: true,
              articleCode: true,
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
    return {
      ...job,
      payload: {
        message: formatOperationalAlert({
          kind: kind as Parameters<typeof formatOperationalAlert>[0]['kind'],
          vehicle: vehicleTitle(vehicle),
          registrationNumber: vehicle.registrationNumber,
          silentForMs: lastSignalAt ? now.getTime() - lastSignalAt.getTime() : null,
          clientName: rental
            ? personName(rental.client)
            : fine?.client
              ? personName(fine.client)
              : null,
          clientPhone: rental
            ? decryptedPhone(rental.client.phoneEncrypted)
            : fine?.client
              ? decryptedPhone(fine.client.phoneEncrypted)
              : null,
          rentalEndsAt: rental?.endsAt ?? null,
          eventTitle: event?.title ?? null,
          eventDescription: event?.description ?? null,
          eventRecordedAt:
            typeof payload.recordedAt === 'string'
              ? new Date(payload.recordedAt)
              : event?.recordedAt ?? null,
          fineAmountMinor: fine?.currentAmountMinor.toString() ?? null,
          fineArticle: fine?.articleCode ?? null,
          fineAttributedToClient: Boolean(fine?.clientId),
          fuelLevelPercent: numberOrNull(payload.fuelLevelPercent),
          borderCountry: typeof payload.borderCountry === 'string' ? payload.borderCountry : null,
          borderDistanceKm: numberOrNull(payload.borderDistanceKm),
          stationLabel: typeof payload.stationLabel === 'string' ? payload.stationLabel : null,
        }),
        parseMode: 'HTML',
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
    return {
      ...job,
      payload: {
        message: formatOperationsDigest({
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
                          (rental.endsAt.getTime() - rental.startsAt.getTime()) /
                            (24 * 60 * 60_000),
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
        }),
        parseMode: 'HTML',
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
  const phone =
    key && rental.client.phoneEncrypted
      ? decryptField(rental.client.phoneEncrypted, key)
      : 'нет телефона';
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
      if (job) claimed.push(await hydrateJob(tx, now, job));
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
