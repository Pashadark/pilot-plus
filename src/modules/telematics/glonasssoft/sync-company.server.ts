import 'server-only';

import { prisma as defaultPrisma } from '@/database/prisma/client';
import { decryptField } from '@/services/security/field-encryption';
import { findRussiaBorderProximity } from '@/modules/geography/russia-border';
import { detectConfirmedImpoundStay } from '@/modules/geography/impound-lots';
import { processFuelStationPosition } from '@/modules/fuel-stations/server/visit-service';
import { processVehicleServicePosition } from '@/modules/vehicles/server/service-visit-service';

import { GlonassSoftClient } from './client.server';
import {
  detectAndPersistHarshAcceleration,
  type HarshAccelerationRepository,
} from './harsh-acceleration-events.server';
import {
  detectAndPersistHarshBraking,
  type HarshBrakingRepository,
} from './harsh-braking-events.server';

export class TelematicsSyncError extends Error {
  constructor(public readonly code: 'NOT_CONFIGURED') {
    super('Интеграция GLONASSSoft не настроена.');
    this.name = 'TelematicsSyncError';
  }
}

type LastData = Awaited<ReturnType<GlonassSoftClient['getLastData']>>[number];

const SPEEDING_ALERT_THRESHOLD_KPH = 145;

interface SyncDatabase {
  telematicsIntegration: {
    findUnique(args: unknown): Promise<{
      companyId: string;
      baseUrl: string;
      usernameEncrypted: string;
      passwordEncrypted: string;
      enabled: boolean;
    } | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  telematicsVehicleLink: {
    findMany(args: unknown): Promise<
      Array<{
        vehicleId: string;
        externalId: string;
        registrationNumberNormalized: string;
      }>
    >;
  };
  $transaction<T>(callback: (database: SyncTransaction) => Promise<T>): Promise<T>;
}

interface SyncTransaction {
  vehiclePosition: {
    createMany(args: unknown): Promise<{ count: number }>;
    findFirst?: (args: unknown) => Promise<{
      id?: string;
      latitude: unknown;
      longitude: unknown;
      speedKph: number | null;
      recordedAt: Date;
    } | null>;
    findMany?: (args: unknown) => Promise<
      Array<{
        id?: string;
        latitude: unknown;
        longitude: unknown;
        speedKph: number | null;
        recordedAt: Date;
      }>
    >;
  };
  vehicleEvent?: {
    createMany(args: unknown): Promise<{ count: number }>;
    upsert?(args: unknown): Promise<{ id: string }>;
  };
  companyGpsSettings?: { findUnique(args: unknown): Promise<unknown> };
  vehicleGpsSettingsOverride?: { findUnique(args: unknown): Promise<unknown> };
  vehicle: {
    updateMany(args: unknown): Promise<{ count: number }>;
    findFirst?: (args: unknown) => Promise<{
      engineHours: unknown | null;
      make?: string | null;
      modelName?: string | null;
      model?: string | null;
      registrationNumber?: string | null;
    } | null>;
  };
  rental?: {
    findFirst(args: unknown): Promise<{
      id?: string;
      clientId?: string;
      contractNumber: string | null;
      client: { firstName: string; middleName: string | null; lastName: string };
    } | null>;
  };
  telegramGroupBinding?: {
    findUnique(args: unknown): Promise<{ telegramChatId: string } | null>;
  };
  telegramIdentity?: {
    findUnique(args: unknown): Promise<{ id: string; isActive: boolean } | null>;
  };
  botNotificationJob?: { createMany(args: unknown): Promise<{ count: number }> };
  fuelStation?: { findMany(args: unknown): Promise<unknown[]> };
  fuelStationVisit?: {
    findFirst(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  vehicleServiceVisit?: {
    findFirst(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<unknown>;
  };
}

interface SyncClient {
  getLastData(externalIds: readonly string[]): Promise<readonly LastData[]>;
}

interface SyncDependencies {
  prisma: SyncDatabase;
  createClient(input: { baseUrl: string; username: string; password: string }): SyncClient;
  decrypt(value: string): string;
  now(): Date;
}

export async function syncCompanyLatestPositions(
  companyId: string,
  dependencies?: Partial<SyncDependencies>,
) {
  const deps = {
    prisma: dependencies?.prisma ?? (defaultPrisma as unknown as SyncDatabase),
    createClient: dependencies?.createClient ?? ((input) => new GlonassSoftClient(input)),
    decrypt:
      dependencies?.decrypt ??
      ((value: string) => {
        const encryptionKey = process.env.CLIENT_DATA_ENCRYPTION_KEY;
        if (!encryptionKey) throw new TelematicsSyncError('NOT_CONFIGURED');
        return decryptField(value, encryptionKey);
      }),
    now: dependencies?.now ?? (() => new Date()),
  };
  const integration = await deps.prisma.telematicsIntegration.findUnique({
    where: { companyId, enabled: true },
  });
  if (!integration?.enabled) throw new TelematicsSyncError('NOT_CONFIGURED');

  const links = await deps.prisma.telematicsVehicleLink.findMany({
    where: { companyId, provider: 'GLONASSSOFT', vehicle: { archivedAt: null } },
    orderBy: { externalId: 'asc' },
    select: {
      vehicleId: true,
      externalId: true,
      registrationNumberNormalized: true,
    },
  });
  const attemptedAt = deps.now();
  await deps.prisma.telematicsIntegration.updateMany({
    where: { companyId, enabled: true },
    data: { lastAttemptAt: attemptedAt },
  });
  if (links.length === 0) {
    await deps.prisma.telematicsIntegration.updateMany({
      where: { companyId, enabled: true },
      data: { lastSuccessAt: attemptedAt, lastErrorCode: null },
    });
    return { requested: 0, saved: 0, skipped: 0, changedVehicleIds: [] as string[] };
  }

  try {
    const client = deps.createClient({
      baseUrl: integration.baseUrl,
      username: deps.decrypt(integration.usernameEncrypted),
      password: deps.decrypt(integration.passwordEncrypted),
    });
    const data = await client.getLastData(links.map((link) => link.externalId));
    const linkByExternalId = new Map(links.map((link) => [link.externalId, link]));
    let saved = 0;
    let skipped = 0;
    const changedVehicleIds: string[] = [];
    await deps.prisma.$transaction(async (database) => {
      for (const point of data) {
        const link = linkByExternalId.get(point.externalId);
        if (!link) {
          skipped += 1;
          continue;
        }
        const changed = await savePoint(database, companyId, link.vehicleId, point);
        if (changed) {
          saved += 1;
          changedVehicleIds.push(link.vehicleId);
        }
      }
    });
    const successfulAt = deps.now();
    await deps.prisma.telematicsIntegration.updateMany({
      where: { companyId, enabled: true },
      data: { lastSuccessAt: successfulAt, lastErrorCode: null },
    });
    return {
      requested: links.length,
      saved,
      skipped,
      changedVehicleIds: [...new Set(changedVehicleIds)].sort(),
    };
  } catch (error) {
    await deps.prisma.telematicsIntegration.updateMany({
      where: { companyId, enabled: true },
      data: { lastErrorCode: safeErrorCode(error) },
    });
    throw error;
  }
}

async function savePoint(
  database: SyncTransaction,
  companyId: string,
  vehicleId: string,
  point: LastData,
): Promise<boolean> {
  const recordedAt = new Date(point.recordedAt);
  const providerReceivedAt = new Date(point.receivedAt);
  const externalId = `${point.externalId}:${recordedAt.toISOString()}`;
  const previous = database.vehiclePosition.findFirst
    ? await database.vehiclePosition.findFirst({
        where: { vehicleId, provider: 'GLONASSSOFT', recordedAt: { lt: recordedAt } },
        select: { latitude: true, longitude: true, speedKph: true, recordedAt: true },
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      })
    : null;
  const currentVehicle = database.vehicle.findFirst
    ? await database.vehicle.findFirst({
        where: { id: vehicleId, companyId },
        select: {
          engineHours: true,
          make: true,
          modelName: true,
          model: true,
          registrationNumber: true,
        },
      })
    : null;
  const heading = previous
    ? bearingDegrees(
        Number(previous.longitude),
        Number(previous.latitude),
        point.longitude,
        point.latitude,
      )
    : null;
  const elapsedMs = previous ? recordedAt.getTime() - previous.recordedAt.getTime() : 0;
  const engineHours =
    currentVehicle &&
    Number.isFinite(Number(currentVehicle.engineHours)) &&
    elapsedMs > 0 &&
    elapsedMs <= 15 * 60_000 &&
    (point.speedKph > 0 || (previous?.speedKph ?? 0) > 0)
      ? Math.round((Number(currentVehicle.engineHours) + elapsedMs / 3_600_000) * 10) / 10
      : null;
  const inserted = await database.vehiclePosition.createMany({
    data: [
      {
        vehicleId,
        latitude: point.latitude,
        longitude: point.longitude,
        speedKph: Math.round(point.speedKph),
        heading,
        odometerKm: point.odometerKm,
        fuelLevelPercent: point.fuelPercent,
        address: point.address,
        recordedAt,
        provider: 'GLONASSSOFT',
        externalId,
        providerRecordedAt: recordedAt,
        receivedAt: providerReceivedAt,
      },
    ],
    skipDuplicates: true,
  });
  if (inserted.count === 0) return false;
  await database.vehicle.updateMany({
    where: { id: vehicleId, companyId, archivedAt: null },
    data: {
      ...(point.odometerKm === null ? {} : { odometerKm: point.odometerKm }),
      ...(engineHours === null ? {} : { engineHours }),
      status: stateToStatus(point.state),
    },
  });
  await persistHarshAccelerationEvent(database, companyId, vehicleId, externalId);
  await persistHarshBrakingEvent(database, companyId, vehicleId, externalId);
  const previousSpeedKph = previous?.speedKph ?? null;
  const crossedSpeedingThreshold =
    point.speedKph >= SPEEDING_ALERT_THRESHOLD_KPH &&
    (previousSpeedKph === null || previousSpeedKph < SPEEDING_ALERT_THRESHOLD_KPH);
  if (crossedSpeedingThreshold) {
    await database.vehicleEvent?.createMany({
      data: [
        {
          vehicleId,
          type: 'SPEEDING',
          severity: 'DANGER',
          title: `Скорость ${Math.round(point.speedKph)} км/ч`,
          description: `Зафиксирована скорость ${SPEEDING_ALERT_THRESHOLD_KPH} км/ч или выше.`,
          location: point.address,
          recordedAt,
          provider: 'GLONASSSOFT',
          externalId: `${externalId}:speeding-${SPEEDING_ALERT_THRESHOLD_KPH}`,
        },
      ],
      skipDuplicates: true,
    });
  }
  await enqueueBorderAlert(database, companyId, vehicleId, recordedAt, point, currentVehicle);
  await enqueueImpoundAlert(database, companyId, vehicleId, recordedAt);
  if (database.vehicleServiceVisit) {
    await processVehicleServicePosition(database as never, {
      companyId,
      vehicleId,
      latitude: point.latitude,
      longitude: point.longitude,
      recordedAt,
      receivedAt: providerReceivedAt,
    });
  }
  if (database.fuelStation && database.fuelStationVisit) {
    await processFuelStationPosition(database as never, {
      companyId,
      vehicleId,
      latitude: point.latitude,
      longitude: point.longitude,
      recordedAt,
    }).catch(() => undefined);
  }
  return true;
}

async function persistHarshAccelerationEvent(
  database: SyncTransaction,
  companyId: string,
  vehicleId: string,
  positionExternalId: string,
) {
  if (
    !database.companyGpsSettings?.findUnique ||
    !database.vehicleGpsSettingsOverride?.findUnique ||
    !database.vehiclePosition.findMany ||
    !database.vehiclePosition.findFirst ||
    !database.rental?.findFirst ||
    !database.vehicleEvent?.upsert
  ) {
    return;
  }

  const latestPosition = await database.vehiclePosition.findFirst({
    where: { vehicleId, provider: 'GLONASSSOFT', externalId: positionExternalId },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      speedKph: true,
      recordedAt: true,
    },
  });
  if (!latestPosition?.id) return;

  await detectAndPersistHarshAcceleration({
    companyId,
    vehicleId,
    latestPositionId: latestPosition.id,
    prisma: database as unknown as HarshAccelerationRepository,
  }).catch(() => undefined);
}

async function persistHarshBrakingEvent(
  database: SyncTransaction,
  companyId: string,
  vehicleId: string,
  positionExternalId: string,
) {
  if (
    !database.companyGpsSettings?.findUnique ||
    !database.vehicleGpsSettingsOverride?.findUnique ||
    !database.vehiclePosition.findMany ||
    !database.vehiclePosition.findFirst ||
    !database.rental?.findFirst ||
    !database.vehicleEvent?.upsert
  ) {
    return;
  }

  const latestPosition = await database.vehiclePosition.findFirst({
    where: { vehicleId, provider: 'GLONASSSOFT', externalId: positionExternalId },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      speedKph: true,
      recordedAt: true,
    },
  });
  if (!latestPosition?.id) return;

  await detectAndPersistHarshBraking({
    companyId,
    vehicleId,
    latestPositionId: latestPosition.id,
    prisma: database as unknown as HarshBrakingRepository,
  }).catch(() => undefined);
}

async function enqueueImpoundAlert(
  database: SyncTransaction,
  companyId: string,
  vehicleId: string,
  recordedAt: Date,
) {
  if (
    !database.vehiclePosition.findMany ||
    !database.telegramGroupBinding?.findUnique ||
    !database.botNotificationJob?.createMany
  ) {
    return;
  }
  const recentPositions = await database.vehiclePosition.findMany({
    where: {
      vehicleId,
      provider: 'GLONASSSOFT',
      recordedAt: {
        gte: new Date(recordedAt.getTime() - 45 * 60_000),
        lte: recordedAt,
      },
    },
    select: { latitude: true, longitude: true, speedKph: true, recordedAt: true },
    orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
    take: 100,
  });
  const stay = detectConfirmedImpoundStay(
    recentPositions.map((position) => ({
      latitude: Number(position.latitude),
      longitude: Number(position.longitude),
      speedKph: position.speedKph,
      recordedAt: position.recordedAt,
    })),
  );
  if (!stay) return;
  const { lot, enteredAt } = stay;
  const binding = await database.telegramGroupBinding.findUnique({
    where: { companyId },
    select: { telegramChatId: true },
  });
  if (!binding) return;
  const rental = database.rental
    ? await database.rental.findFirst({
        where: {
          companyId,
          vehicleId,
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          startsAt: { lte: recordedAt },
          endsAt: { gte: recordedAt },
        },
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          contractNumber: true,
          client: { select: { firstName: true, middleName: true, lastName: true } },
        },
      })
    : null;
  await database.botNotificationJob.createMany({
    data: [
      {
        companyId,
        chatId: binding.telegramChatId,
        template: 'OPERATIONAL_ALERT',
        eventKey: `impound-entry:${companyId}:${vehicleId}:${lot.id}:${moscowDateKey(enteredAt)}`,
        payload: {
          kind: 'IMPOUND_LOT_ENTRY',
          vehicleId,
          ...(rental?.id ? { rentalId: rental.id } : {}),
          impoundLotId: lot.id,
          recordedAt: recordedAt.toISOString(),
        },
        availableAt: recordedAt,
      },
    ],
    skipDuplicates: true,
  });
}

function moscowDateKey(value: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function enqueueBorderAlert(
  database: SyncTransaction,
  companyId: string,
  vehicleId: string,
  recordedAt: Date,
  point: LastData,
  vehicle: {
    make?: string | null;
    modelName?: string | null;
    model?: string | null;
    registrationNumber?: string | null;
  } | null,
) {
  if (!database.telegramGroupBinding?.findUnique || !database.botNotificationJob?.createMany) {
    return;
  }
  const proximity = findRussiaBorderProximity(point.latitude, point.longitude, 100);
  if (!proximity) return;
  const binding = await database.telegramGroupBinding.findUnique({
    where: { companyId },
    select: { telegramChatId: true },
  });
  if (!binding) return;
  const rental = database.rental
    ? await database.rental.findFirst({
        where: {
          companyId,
          vehicleId,
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          startsAt: { lte: recordedAt },
          endsAt: { gte: recordedAt },
        },
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
        select: {
          contractNumber: true,
          client: { select: { firstName: true, middleName: true, lastName: true } },
        },
      })
    : null;
  const vehicleName = [
    vehicle?.make,
    vehicle?.modelName ?? vehicle?.model,
    vehicle?.registrationNumber,
  ]
    .filter(Boolean)
    .join(' ');
  const driverName = rental
    ? [rental.client.lastName, rental.client.firstName, rental.client.middleName]
        .filter(Boolean)
        .join(' ')
    : null;
  const message = [
    '⚠️ Машина приближается к границе России',
    vehicleName || `Автомобиль ${vehicleId}`,
    `Граница: ${proximity.country}`,
    `Расстояние: ${proximity.distanceKm.toFixed(1)} км`,
    driverName ? `Водитель: ${driverName}` : 'Водитель: не определён',
    rental?.contractNumber ? `Договор: ${rental.contractNumber}` : null,
    `Время: ${new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(recordedAt)}`,
  ]
    .filter(Boolean)
    .join('\n');
  const dayKey = recordedAt.toISOString().slice(0, 10);
  await database.botNotificationJob.createMany({
    data: [
      {
        companyId,
        chatId: binding.telegramChatId,
        template: 'OPERATIONAL_ALERT',
        eventKey: `border-approach:${companyId}:${vehicleId}:${proximity.countryCode}:${dayKey}:group`,
        payload: {
          kind: 'BORDER_APPROACH',
          vehicleId,
          borderCountry: proximity.country,
          borderDistanceKm: proximity.distanceKm,
          recordedAt: recordedAt.toISOString(),
          message,
        },
        availableAt: recordedAt,
      },
    ],
    skipDuplicates: true,
  });
}

function bearingDegrees(
  fromLongitude: number,
  fromLatitude: number,
  toLongitude: number,
  toLatitude: number,
) {
  const fromLat = (fromLatitude * Math.PI) / 180;
  const toLat = (toLatitude * Math.PI) / 180;
  const deltaLongitude = ((toLongitude - fromLongitude) * Math.PI) / 180;
  const bearing = Math.atan2(
    Math.sin(deltaLongitude) * Math.cos(toLat),
    Math.cos(fromLat) * Math.sin(toLat) -
      Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLongitude),
  );
  return Math.round(((((bearing * 180) / Math.PI + 360) % 360) + 360) % 360);
}

function stateToStatus(state: number) {
  if (state === 4) return 'MOVING';
  if (state === 2 || state === 3) return 'IDLE';
  return 'OFFLINE';
}

function safeErrorCode(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^(INVALID_REQUEST|AUTH_REJECTED|FORBIDDEN|RATE_LIMITED|TIMEOUT|UNAVAILABLE|INVALID_RESPONSE)$/u.test(
      error.code,
    )
  ) {
    return error.code;
  }
  return 'UNAVAILABLE';
}
