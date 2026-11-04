import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { SafeUser } from '@/modules/auth/types';
import { parsePilotDateTimeLocal, PILOT_BUSINESS_TIME_ZONE } from '@/shared/business-time';

import type {
  OnlineMapTrackFine,
  OnlineMapTrackHistoryDto,
  TrackCoordinates,
  VehicleTrack,
  VehicleTrackEvent,
  VehicleTrackPoint,
} from '../track-types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 7;
const FINE_INFERENCE_WINDOW_MS = 30 * 60 * 1_000;

export type TrackHistoryErrorCode = 'INVALID_INPUT' | 'INVALID_RANGE' | 'FORBIDDEN';

export class TrackHistoryError extends Error {
  constructor(
    public readonly code: TrackHistoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TrackHistoryError';
  }
}

interface TrackHistoryRepository {
  vehicle: {
    findFirst(args: unknown): Promise<unknown>;
  };
}

interface PositionRow {
  id: string;
  latitude: unknown;
  longitude: unknown;
  speedKph: number | null;
  address: string | null;
  recordedAt: Date;
}

interface FineRow {
  id: string;
  decreeNumber: string;
  offenseAt: Date;
  latitude: unknown | null;
  longitude: unknown | null;
  currentAmountMinor: bigint | number;
  status: string;
  description: string | null;
  address: string | null;
  rental: { id: string; contractNumber: string | null } | null;
  client: {
    id: string;
    lastName: string;
    firstName: string;
    middleName: string | null;
  } | null;
}

interface VehicleHistoryRow {
  id: string;
  positions: PositionRow[];
  fines: FineRow[];
  events?: VehicleEventRow[];
}

interface VehicleEventRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  recordedAt: Date;
  endLatitude: unknown | null;
  endLongitude: unknown | null;
  startSpeedKph: number | null;
  endSpeedKph: number | null;
  durationMs: number | null;
  trackPointIds: unknown;
}

interface ValidPosition extends PositionRow {
  coordinates: TrackCoordinates;
  date: string;
}

export async function getOnlineMapTrackHistory(
  user: SafeUser,
  input: { vehicleId: string; from: string; to: string },
  repository: TrackHistoryRepository = prisma,
): Promise<OnlineMapTrackHistoryDto> {
  const range = parseTrackHistoryRange(input);
  const vehicleWhere =
    user.role === 'SUPER_ADMIN'
      ? { id: input.vehicleId, archivedAt: null, isDemoImport: false }
      : {
          id: input.vehicleId,
          archivedAt: null,
          isDemoImport: false,
          company: { members: { some: { userId: user.id } } },
        };

  const row = (await repository.vehicle.findFirst({
    where: vehicleWhere,
    select: {
      id: true,
      positions: {
        where: {
          recordedAt: { gte: range.from, lt: range.toExclusive },
          provider: 'GLONASSSOFT',
        },
        select: {
          id: true,
          latitude: true,
          longitude: true,
          speedKph: true,
          address: true,
          recordedAt: true,
        },
        orderBy: { recordedAt: 'asc' },
      },
      fines: {
        where: { offenseAt: { gte: range.from, lt: range.toExclusive } },
        select: {
          id: true,
          decreeNumber: true,
          offenseAt: true,
          latitude: true,
          longitude: true,
          currentAmountMinor: true,
          status: true,
          description: true,
          address: true,
          rental: { select: { id: true, contractNumber: true } },
          client: { select: { id: true, lastName: true, firstName: true, middleName: true } },
        },
        orderBy: { offenseAt: 'asc' },
      },
      events: {
        where: {
          type: { in: ['HARSH_ACCELERATION', 'HARSH_BRAKING'] },
          recordedAt: { gte: range.from, lt: range.toExclusive },
        },
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          recordedAt: true,
          endLatitude: true,
          endLongitude: true,
          startSpeedKph: true,
          endSpeedKph: true,
          durationMs: true,
          trackPointIds: true,
        },
        orderBy: { recordedAt: 'asc' },
      },
    },
  })) as VehicleHistoryRow | null;

  if (!row) {
    throw new TrackHistoryError('FORBIDDEN', 'Автомобиль недоступен.');
  }

  const positions = row.positions
    .map(toValidPosition)
    .filter((position): position is ValidPosition => position !== null)
    .sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime());
  const tracks = buildVehicleTracks(row.id, positions, row.events ?? []);

  return {
    vehicleId: row.id,
    from: input.from,
    to: input.to,
    availableDates: tracks
      .map((track) => track.date)
      .sort((left, right) => right.localeCompare(left)),
    tracks,
    fines: row.fines.map((fine) => toFineDto(fine, positions)),
  };
}

export function mapTrackHistoryErrorStatus(error: unknown): number {
  if (!(error instanceof TrackHistoryError)) return 500;
  if (error.code === 'FORBIDDEN') return 403;
  return 400;
}

function parseTrackHistoryRange(input: { vehicleId: string; from: string; to: string }) {
  if (!input.vehicleId.trim() || !DATE_PATTERN.test(input.from) || !DATE_PATTERN.test(input.to)) {
    throw new TrackHistoryError('INVALID_INPUT', 'Укажите автомобиль и корректные даты.');
  }

  const from = parsePilotDateTimeLocal(`${input.from}T00:00`);
  const to = parsePilotDateTimeLocal(`${input.to}T00:00`);
  if (!from || !to || to < from) {
    throw new TrackHistoryError('INVALID_RANGE', 'Некорректный период маршрута.');
  }

  const dayCount = calendarDayDifference(input.from, input.to) + 1;
  if (dayCount > MAX_RANGE_DAYS) {
    throw new TrackHistoryError('INVALID_RANGE', 'Можно запросить не больше семи дней.');
  }

  const dayAfterTo = addCalendarDays(input.to, 1);
  const toExclusive = parsePilotDateTimeLocal(`${dayAfterTo}T00:00`);
  if (!toExclusive) {
    throw new TrackHistoryError('INVALID_RANGE', 'Некорректная конечная дата.');
  }

  return { from, toExclusive };
}

function calendarDayDifference(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  return Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) /
      86_400_000,
  );
}

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function formatMoscowDate(value: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: PILOT_BUSINESS_TIME_ZONE,
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

function formatMoscowTime(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: PILOT_BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value);
}

function coordinate(value: unknown, minimum: number, maximum: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

function toValidPosition(position: PositionRow): ValidPosition | null {
  const latitude = coordinate(position.latitude, -90, 90);
  const longitude = coordinate(position.longitude, -180, 180);
  if (latitude === null || longitude === null) return null;

  return {
    ...position,
    coordinates: [longitude, latitude],
    date: formatMoscowDate(position.recordedAt),
  };
}

function buildVehicleTracks(
  vehicleId: string,
  positions: readonly ValidPosition[],
  events: readonly VehicleEventRow[],
): VehicleTrack[] {
  const grouped = new Map<string, ValidPosition[]>();
  for (const position of positions) {
    const group = grouped.get(position.date) ?? [];
    group.push(position);
    grouped.set(position.date, group);
  }

  return [...grouped.entries()]
    .filter(([, points]) => points.length >= 2)
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, points]) => {
      const pointIds = new Set(points.map((point) => point.id));
      return {
        vehicleId,
        date,
        points: points.map((point): VehicleTrackPoint => ({
          id: point.id,
          coordinates: point.coordinates,
          timestamp: formatMoscowTime(point.recordedAt),
          recordedAt: point.recordedAt.toISOString(),
          speedKph: Math.max(0, point.speedKph ?? 0),
          address: point.address ?? 'Адрес не определён',
        })),
        events: events
          .filter((event) => formatMoscowDate(event.recordedAt) === date)
          .map((event) => toTrackEvent(event, positions))
          .filter(
            (event): event is VehicleTrackEvent => event !== null && pointIds.has(event.pointId),
          ),
      };
    });
}

function toTrackEvent(
  event: VehicleEventRow,
  positions: readonly ValidPosition[],
): VehicleTrackEvent | null {
  if (event.type !== 'HARSH_ACCELERATION' && event.type !== 'HARSH_BRAKING') return null;
  const declaredPointIds = Array.isArray(event.trackPointIds)
    ? event.trackPointIds.filter((value): value is string => typeof value === 'string')
    : [];
  const declaredPointId = declaredPointIds.at(-1) ?? null;
  const declaredPoint = declaredPointId
    ? (positions.find((position) => position.id === declaredPointId) ?? null)
    : null;
  const nearest = declaredPoint ?? findNearestPosition(event.recordedAt, positions);
  if (!nearest) return null;
  const latitude = coordinate(event.endLatitude, -90, 90);
  const longitude = coordinate(event.endLongitude, -180, 180);
  const startSpeedKph = Math.max(0, Math.round(event.startSpeedKph ?? 0));
  const endSpeedKph = Math.max(0, Math.round(event.endSpeedKph ?? nearest.speedKph ?? 0));
  const durationSeconds = Math.max(1, Math.round((event.durationMs ?? 0) / 1_000));

  return {
    id: event.id,
    type: event.type === 'HARSH_BRAKING' ? 'harsh-braking' : 'harsh-acceleration',
    pointId: nearest.id,
    title: event.title,
    description:
      event.type === 'HARSH_BRAKING'
        ? `Скорость снизилась с ${startSpeedKph} до ${endSpeedKph} км/ч за ${durationSeconds} сек.`
        : `Скорость выросла с ${startSpeedKph} до ${endSpeedKph} км/ч за ${durationSeconds} сек.`,
    coordinates:
      latitude !== null && longitude !== null ? [longitude, latitude] : nearest.coordinates,
    timestamp: formatMoscowTime(event.recordedAt),
    speedKph: endSpeedKph,
    metricLabel: `${startSpeedKph}→${endSpeedKph}`,
    address: nearest.address ?? 'Адрес не определён',
  };
}

function toFineDto(fine: FineRow, positions: readonly ValidPosition[]): OnlineMapTrackFine {
  const latitude = coordinate(fine.latitude, -90, 90);
  const longitude = coordinate(fine.longitude, -180, 180);
  const nearest = findNearestPosition(fine.offenseAt, positions);
  const hasExactCoordinates = latitude !== null && longitude !== null;
  const inferred = !hasExactCoordinates && nearest !== null;

  return {
    id: fine.id,
    decreeNumber: fine.decreeNumber,
    offenseAt: fine.offenseAt.toISOString(),
    coordinates: hasExactCoordinates
      ? [longitude, latitude]
      : inferred
        ? nearest.coordinates
        : null,
    pointId: inferred ? nearest.id : null,
    locationSource: hasExactCoordinates ? 'exact' : inferred ? 'time-inferred' : 'unmapped',
    amountMinor: Number(fine.currentAmountMinor),
    status: fine.status,
    description: fine.description,
    address: fine.address ?? nearest?.address ?? null,
    rentalId: fine.rental?.id ?? null,
    contractNumber: fine.rental?.contractNumber ?? null,
    clientId: fine.client?.id ?? null,
    clientName: fine.client
      ? [fine.client.lastName, fine.client.firstName, fine.client.middleName]
          .filter(Boolean)
          .join(' ')
      : null,
  };
}

function findNearestPosition(
  offenseAt: Date,
  positions: readonly ValidPosition[],
): ValidPosition | null {
  let nearest: ValidPosition | null = null;
  let nearestDifference = Number.POSITIVE_INFINITY;

  for (const position of positions) {
    const difference = Math.abs(position.recordedAt.getTime() - offenseAt.getTime());
    if (difference < nearestDifference) {
      nearest = position;
      nearestDifference = difference;
    }
  }

  return nearestDifference <= FINE_INFERENCE_WINDOW_MS ? nearest : null;
}
