import 'server-only';

import { queueGpsEventNotifications } from '@/modules/bot-api/gps-event-notifications';

import { detectHarshAcceleration, type AccelerationSample } from '../domain/harsh-acceleration';
import {
  DEFAULT_GPS_SETTINGS,
  resolveGpsSettings,
  type CompanyGpsSettingsShape,
  type GpsNotificationMode,
  type ResolvedGpsSettings,
  type VehicleGpsSettingsOverrideShape,
} from '../domain/gps-settings';

type SettingsRow = Partial<ResolvedGpsSettings> | null;

type PositionRow = {
  id: string;
  recordedAt: Date;
  latitude: unknown;
  longitude: unknown;
  speedKph: number | null;
  address?: string | null;
};

export interface HarshAccelerationRepository {
  telegramGroupBinding?: {
    findUnique(args: unknown): Promise<{ telegramChatId: string } | null>;
  };
  telegramIdentity?: {
    findUnique(args: unknown): Promise<{ id: string; isActive: boolean } | null>;
  };
  botNotificationJob?: {
    createMany(args: unknown): Promise<{ count: number }>;
  };
  companyGpsSettings: {
    findUnique(args: unknown): Promise<SettingsRow>;
  };
  vehicleGpsSettingsOverride: {
    findUnique(args: unknown): Promise<SettingsRow>;
  };
  vehiclePosition: {
    findMany(args: unknown): Promise<PositionRow[]>;
  };
  rental: {
    findFirst(args: unknown): Promise<{ id: string; clientId: string } | null>;
  };
  vehicleEvent: {
    upsert(args: unknown): Promise<{ id: string }>;
  };
}

const SETTINGS_KEYS = Object.keys(DEFAULT_GPS_SETTINGS) as Array<keyof ResolvedGpsSettings>;

export async function detectAndPersistHarshAcceleration(input: {
  companyId: string;
  vehicleId: string;
  latestPositionId: string;
  prisma: HarshAccelerationRepository;
}): Promise<{ createdEventIds: string[] }> {
  const [companyRow, vehicleRow] = await Promise.all([
    input.prisma.companyGpsSettings.findUnique({ where: { companyId: input.companyId } }),
    input.prisma.vehicleGpsSettingsOverride.findUnique({ where: { vehicleId: input.vehicleId } }),
  ]);
  const settings = resolveGpsSettings(
    companyRow ? toCompanySettings(companyRow) : null,
    vehicleRow ? toVehicleOverride(vehicleRow) : null,
  );
  if (!settings.accelerationDetectionEnabled) return { createdEventIds: [] };

  const positions = await input.prisma.vehiclePosition.findMany({
    where: { vehicleId: input.vehicleId, provider: 'GLONASSSOFT' },
    select: {
      id: true,
      recordedAt: true,
      latitude: true,
      longitude: true,
      speedKph: true,
      address: true,
    },
    orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
    take: 20,
  });
  const orderedPositions = [...positions].sort(
    (left, right) => left.recordedAt.getTime() - right.recordedAt.getTime(),
  );
  const positionsById = new Map(orderedPositions.map((position) => [position.id, position]));
  const samples = orderedPositions.map(toAccelerationSample);
  const events = detectHarshAcceleration(samples, {
    harshThresholdMps2: settings.harshAccelerationThresholdMps2,
    criticalThresholdMps2: settings.criticalAccelerationThresholdMps2,
    confirmationWindowMs: settings.confirmationWindowMs,
    mergeWindowMs: settings.mergeWindowMs,
    maximumGapMs: settings.maximumGapMs,
  }).filter((event) => event.endPointId === input.latestPositionId);
  const eventIds: string[] = [];

  for (const event of events) {
    const start = positionsById.get(event.startPointId);
    const end = positionsById.get(event.endPointId);
    if (!start || !end) continue;

    const rental = await input.prisma.rental.findFirst({
      where: {
        companyId: input.companyId,
        vehicleId: input.vehicleId,
        status: { in: ['CONFIRMED', 'ACTIVE'] },
        startsAt: { lte: event.startedAt },
        endsAt: { gte: event.startedAt },
      },
      select: { id: true, clientId: true },
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    });
    const externalId = `harsh-acceleration:${event.startPointId}`;
    const severity = event.severity === 'CRITICAL' ? 'DANGER' : 'WARNING';
    const shared = {
      companyId: input.companyId,
      rentalId: rental?.id ?? null,
      clientId: rental?.clientId ?? null,
      severity,
      title: event.severity === 'CRITICAL' ? 'Критически резкий разгон' : 'Резкий разгон',
      description: `Скорость выросла с ${Math.round(event.startSpeedKph)} до ${Math.round(event.endSpeedKph)} км/ч за ${Math.max(1, Math.round(event.durationMs / 1_000))} сек.`,
      location: end.address ?? null,
      recordedAt: event.endedAt,
      startedAt: event.startedAt,
      endedAt: event.endedAt,
      startLatitude: Number(start.latitude),
      startLongitude: Number(start.longitude),
      endLatitude: Number(end.latitude),
      endLongitude: Number(end.longitude),
      startSpeedKph: event.startSpeedKph,
      endSpeedKph: event.endSpeedKph,
      maxAccelerationMps2: event.maxAccelerationMps2,
      durationMs: event.durationMs,
      trackPointIds: event.pointIds,
      details: {
        detectorVersion: 'harsh-acceleration-v1',
        notificationMode: settings.notificationMode,
      },
    };
    const persisted = await input.prisma.vehicleEvent.upsert({
      where: {
        vehicleId_provider_externalId: {
          vehicleId: input.vehicleId,
          provider: 'SUPA_PRO_GPS',
          externalId,
        },
      },
      create: {
        vehicleId: input.vehicleId,
        type: 'HARSH_ACCELERATION',
        provider: 'SUPA_PRO_GPS',
        externalId,
        ...shared,
      },
      update: shared,
      select: { id: true },
    });
    eventIds.push(persisted.id);

    if (input.prisma.telegramGroupBinding && input.prisma.botNotificationJob) {
      await queueGpsEventNotifications({
        companyId: input.companyId,
        vehicleId: input.vehicleId,
        eventId: persisted.id,
        rentalId: rental?.id ?? null,
        clientId: rental?.clientId ?? null,
        recordedAt: event.endedAt,
        kind: 'HARSH_ACCELERATION',
        notificationMode: settings.notificationMode,
        prisma: {
          telegramGroupBinding: input.prisma.telegramGroupBinding,
          ...(input.prisma.telegramIdentity
            ? { telegramIdentity: input.prisma.telegramIdentity }
            : {}),
          botNotificationJob: input.prisma.botNotificationJob,
        },
      });
    }
  }

  return { createdEventIds: eventIds };
}

function toAccelerationSample(position: PositionRow): AccelerationSample {
  return {
    id: position.id,
    recordedAt: position.recordedAt,
    latitude: Number(position.latitude),
    longitude: Number(position.longitude),
    speedKph: Math.max(0, position.speedKph ?? 0),
  };
}

function toCompanySettings(row: NonNullable<SettingsRow>): CompanyGpsSettingsShape {
  return Object.fromEntries(
    SETTINGS_KEYS.map((key) => [key, settingValue(key, row[key], DEFAULT_GPS_SETTINGS[key])]),
  ) as CompanyGpsSettingsShape;
}

function toVehicleOverride(row: NonNullable<SettingsRow>): VehicleGpsSettingsOverrideShape {
  return Object.fromEntries(
    SETTINGS_KEYS.map((key) => [
      key,
      row[key] === undefined || row[key] === null ? null : settingValue(key, row[key], null),
    ]),
  ) as VehicleGpsSettingsOverrideShape;
}

function settingValue(
  key: keyof ResolvedGpsSettings,
  value: unknown,
  fallback: ResolvedGpsSettings[keyof ResolvedGpsSettings] | null,
) {
  if (value === undefined || value === null) return fallback;
  if (key === 'notificationMode') return value as GpsNotificationMode;
  if (key === 'accelerationDetectionEnabled' || key === 'brakingDetectionEnabled') {
    return Boolean(value);
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
