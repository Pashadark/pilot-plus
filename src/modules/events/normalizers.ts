import { createEventKey } from './event-key';
import type { TimelineEventDto, TimelineSeverity } from './types';

type NumericValue = number | string | { toNumber(): number };
type DateValue = Date | string;

export interface TimelineVehicle {
  id: string;
  internalNumber: string;
  model: string;
  imagePath: string | null;
}

interface BaseSource {
  id: string;
  vehicle: TimelineVehicle;
  isRead?: boolean;
}

export interface VehiclePositionSource extends BaseSource {
  recordedAt: DateValue;
  isMoving: boolean;
  latitude: NumericValue;
  longitude: NumericValue;
  speedKph: NumericValue | null;
  heading: NumericValue | null;
  odometerKm: NumericValue | null;
  fuelLevelPercent: NumericValue | null;
  location?: string | null;
}

export interface TripSource extends BaseSource {
  startedAt: DateValue;
  endedAt: DateValue | null;
  distanceKm: NumericValue | null;
  averageSpeedKph: NumericValue | null;
}

export interface VehicleEventSource extends BaseSource {
  title: string;
  description: string | null;
  location: string | null;
  severity: TimelineSeverity;
  recordedAt: DateValue;
}

export interface FuelRecordSource extends BaseSource {
  type: string;
  volumeLiters: NumericValue | null;
  levelPercent: NumericValue | null;
  recordedAt: DateValue;
}

export interface MaintenanceRecordSource extends BaseSource {
  title: string;
  description?: string | null;
  status: string;
  scheduledAt: DateValue | null;
  completedAt: DateValue | null;
  odometerKm: NumericValue | null;
}

export interface WashRecordSource extends BaseSource {
  status: string;
  scheduledAt: DateValue;
  completedAt: DateValue | null;
}

export interface DeviceCommandSource extends BaseSource {
  deviceId: string;
  type: string;
  status: string;
  createdAt: DateValue;
  sentAt: DateValue | null;
  completedAt: DateValue | null;
}

export interface ManualVehicleEventSource extends BaseSource {
  kind: 'NOTE' | 'INCIDENT' | 'ASSIGNMENT';
  severity: TimelineSeverity;
  title: string;
  description: string | null;
  location: string | null;
  latitude: NumericValue | null;
  longitude: NumericValue | null;
  recordedAt: DateValue;
}

const emptyTelemetry = (): TimelineEventDto['telemetry'] => ({
  speedKph: null,
  heading: null,
  odometerKm: null,
  fuelLevelPercent: null,
  fuelVolumeLiters: null,
});

function toNumber(value: NumericValue | null | undefined) {
  if (value == null) {
    return null;
  }

  return typeof value === 'object' ? value.toNumber() : Number(value);
}

function toIso(value: DateValue) {
  return new Date(value).toISOString();
}

function coordinates(latitude: NumericValue | null, longitude: NumericValue | null) {
  const normalizedLatitude = toNumber(latitude);
  const normalizedLongitude = toNumber(longitude);

  return normalizedLatitude == null || normalizedLongitude == null
    ? null
    : { latitude: normalizedLatitude, longitude: normalizedLongitude };
}

function createTimelineEvent(
  source: BaseSource,
  details: Omit<TimelineEventDto, 'isManual' | 'isRead' | 'vehicle'>,
) {
  return {
    ...details,
    isRead: source.isRead ?? false,
    isManual: false,
    vehicle: source.vehicle,
  } satisfies TimelineEventDto;
}

export function normalizeVehiclePosition(source: VehiclePositionSource): TimelineEventDto {
  return createTimelineEvent(source, {
    key: createEventKey('vehicle-position', source.id),
    category: 'MOVEMENT',
    severity: 'INFO',
    title: source.isMoving ? 'Автомобиль в движении' : 'Автомобиль остановлен',
    description: null,
    recordedAt: toIso(source.recordedAt),
    location: source.location ?? null,
    coordinates: coordinates(source.latitude, source.longitude),
    telemetry: {
      ...emptyTelemetry(),
      speedKph: toNumber(source.speedKph),
      heading: toNumber(source.heading),
      odometerKm: toNumber(source.odometerKm),
      fuelLevelPercent: toNumber(source.fuelLevelPercent),
    },
    source: {
      type: 'vehicle-position',
      id: source.id,
      href: `/vehicles/${source.vehicle.id}`,
    },
  });
}

export function normalizeTrip(source: TripSource): TimelineEventDto {
  const isCompleted = source.endedAt != null;

  return createTimelineEvent(source, {
    key: createEventKey('trip', source.id),
    category: isCompleted ? 'TRIP' : 'MOVEMENT',
    severity: 'INFO',
    title: isCompleted ? 'Поездка завершена' : 'Автомобиль в движении',
    description: null,
    recordedAt: toIso(source.endedAt ?? source.startedAt),
    location: null,
    coordinates: null,
    telemetry: {
      ...emptyTelemetry(),
      speedKph: toNumber(source.averageSpeedKph),
      odometerKm: toNumber(source.distanceKm),
    },
    source: {
      type: 'trip',
      id: source.id,
      href: `/vehicles/${source.vehicle.id}?tab=trips`,
    },
  });
}

export function normalizeVehicleEvent(source: VehicleEventSource): TimelineEventDto {
  return createTimelineEvent(source, {
    key: createEventKey('vehicle-event', source.id),
    category: 'ALERT',
    severity: source.severity,
    title: source.title,
    description: source.description,
    recordedAt: toIso(source.recordedAt),
    location: source.location,
    coordinates: null,
    telemetry: emptyTelemetry(),
    source: {
      type: 'vehicle-event',
      id: source.id,
      href: `/vehicles/${source.vehicle.id}?tab=events`,
    },
  });
}

export function normalizeFuelRecord(source: FuelRecordSource): TimelineEventDto {
  const isDrain = source.type === 'DRAIN';

  return createTimelineEvent(source, {
    key: createEventKey('fuel-record', source.id),
    category: 'FUEL',
    severity: isDrain ? 'DANGER' : 'INFO',
    title: isDrain ? 'Слив топлива' : 'Заправка автомобиля',
    description: null,
    recordedAt: toIso(source.recordedAt),
    location: null,
    coordinates: null,
    telemetry: {
      ...emptyTelemetry(),
      fuelLevelPercent: toNumber(source.levelPercent),
      fuelVolumeLiters: toNumber(source.volumeLiters),
    },
    source: {
      type: 'fuel-record',
      id: source.id,
      href: `/vehicles/${source.vehicle.id}?tab=fuel`,
    },
  });
}

export function normalizeMaintenanceRecord(source: MaintenanceRecordSource): TimelineEventDto {
  const isOverdue = source.status === 'OVERDUE';
  const recordedAt = source.completedAt ?? source.scheduledAt;

  if (recordedAt == null) {
    throw new Error('Maintenance record requires scheduledAt or completedAt.');
  }

  return createTimelineEvent(source, {
    key: createEventKey('maintenance-record', source.id),
    category: 'MAINTENANCE',
    severity: isOverdue ? 'WARNING' : 'INFO',
    title: isOverdue ? 'Просроченное техническое обслуживание' : source.title,
    description: source.description ?? null,
    recordedAt: toIso(recordedAt),
    location: null,
    coordinates: null,
    telemetry: {
      ...emptyTelemetry(),
      odometerKm: toNumber(source.odometerKm),
    },
    source: {
      type: 'maintenance-record',
      id: source.id,
      href: '/maintenance',
    },
  });
}

export function normalizeWashRecord(source: WashRecordSource): TimelineEventDto {
  const isCompleted = source.status === 'COMPLETED';

  return createTimelineEvent(source, {
    key: createEventKey('wash-record', source.id),
    category: 'WASH',
    severity: 'INFO',
    title: isCompleted ? 'Мойка завершена' : 'Мойка запланирована',
    description: null,
    recordedAt: toIso(source.completedAt ?? source.scheduledAt),
    location: null,
    coordinates: null,
    telemetry: emptyTelemetry(),
    source: {
      type: 'wash-record',
      id: source.id,
      href: '/wash',
    },
  });
}

export function normalizeDeviceCommand(source: DeviceCommandSource): TimelineEventDto {
  const isFirmwareUpdate = source.type === 'UPDATE_FIRMWARE';
  const isFailed = source.status === 'FAILED';
  const isCompleted = source.status === 'COMPLETED';
  const recordedAt = source.completedAt ?? source.sentAt ?? source.createdAt;

  return createTimelineEvent(source, {
    key: createEventKey('device-command', source.id),
    category: isFirmwareUpdate ? 'FIRMWARE' : 'DEVICE',
    severity: isFailed ? 'WARNING' : 'INFO',
    title: isFailed
      ? 'Команда устройства не выполнена'
      : isFirmwareUpdate && isCompleted
        ? 'Обновление прошивки завершено'
        : isFirmwareUpdate
          ? 'Обновление прошивки запланировано'
          : 'Команда устройства выполнена',
    description: null,
    recordedAt: toIso(recordedAt),
    location: null,
    coordinates: null,
    telemetry: emptyTelemetry(),
    source: {
      type: 'device-command',
      id: source.id,
      href: `/devices/${source.deviceId}`,
    },
  });
}

export function normalizeManualVehicleEvent(source: ManualVehicleEventSource): TimelineEventDto {
  return {
    ...createTimelineEvent(source, {
      key: createEventKey('manual-vehicle-event', source.id),
      category: 'MANUAL',
      severity: source.severity,
      title: source.title,
      description: source.description,
      recordedAt: toIso(source.recordedAt),
      location: source.location,
      coordinates: coordinates(source.latitude, source.longitude),
      telemetry: emptyTelemetry(),
      source: {
        type: 'manual-vehicle-event',
        id: source.id,
        href: `/vehicles/${source.vehicle.id}?tab=history`,
      },
    }),
    isManual: true,
  };
}
