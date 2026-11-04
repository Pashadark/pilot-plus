import type {
  TrackCoordinates,
  TrackPeriodMode,
  TrackActivityKind,
  TrackSpeedColor,
  PlaybackFrame,
  VehicleTrack,
  VehicleTrackEventView,
  VehicleTrackPoint,
  VehicleTrackPeriodViewModel,
  VehicleTrackSegment,
  VehicleTrackActivitySection,
  VehicleTrackViewModel,
} from './track-types';
import { MAX_TRACK_POINT_GAP_MS, TRACK_SPEED_THRESHOLDS } from './track-types';
import {
  DEFAULT_ACCELERATION_DETECTOR_SETTINGS,
  detectHarshAcceleration,
} from '@/modules/telematics/domain/harsh-acceleration';
import {
  DEFAULT_BRAKING_DETECTOR_SETTINGS,
  detectHarshBraking,
} from '@/modules/telematics/domain/harsh-braking';

const EARTH_RADIUS_KM = 6371;

export function getTrackBounds(track: VehicleTrack): { startMs: number; endMs: number } {
  if (track.points.length === 0) {
    throw new Error('Маршрут не содержит GPS-точек');
  }

  return {
    startMs: getTrackPointTimeMs(track, 0),
    endMs: getTrackPointTimeMs(track, track.points.length - 1),
  };
}

export function getTrackPointCursorMs(track: VehicleTrack, pointId: string): number | null {
  const index = track.points.findIndex((point) => point.id === pointId);
  return index >= 0 ? getTrackPointTimeMs(track, index) : null;
}

export function getPlaybackFrame(track: VehicleTrack, cursorMs: number): PlaybackFrame {
  const { startMs, endMs } = getTrackBounds(track);
  const boundedCursorMs = Math.min(endMs, Math.max(startMs, cursorMs));
  const lastIndex = track.points.length - 1;

  if (boundedCursorMs <= startMs || lastIndex === 0) {
    return frameAtPoint(track, 0, boundedCursorMs);
  }
  if (boundedCursorMs >= endMs) {
    return frameAtPoint(track, lastIndex, boundedCursorMs);
  }

  let nextIndex = 1;
  while (
    nextIndex < track.points.length &&
    getTrackPointTimeMs(track, nextIndex) < boundedCursorMs
  ) {
    nextIndex += 1;
  }

  const previousIndex = Math.max(0, nextIndex - 1);
  const previous = track.points[previousIndex];
  const next = track.points[nextIndex];
  const previousMs = getTrackPointTimeMs(track, previousIndex);
  const nextMs = getTrackPointTimeMs(track, nextIndex);

  if (boundedCursorMs === nextMs) {
    return frameAtPoint(track, nextIndex, boundedCursorMs);
  }

  const gapMs = nextMs - previousMs;
  if (gapMs <= 0 || gapMs > MAX_TRACK_POINT_GAP_MS) {
    const nearestIndex =
      boundedCursorMs - previousMs <= nextMs - boundedCursorMs ? previousIndex : nextIndex;
    const frame = frameAtPoint(track, nearestIndex, boundedCursorMs);
    return { ...frame, connected: false };
  }

  const ratio = (boundedCursorMs - previousMs) / gapMs;
  const coordinates: TrackCoordinates = [
    previous.coordinates[0] + (next.coordinates[0] - previous.coordinates[0]) * ratio,
    previous.coordinates[1] + (next.coordinates[1] - previous.coordinates[1]) * ratio,
  ];

  return {
    cursorMs: boundedCursorMs,
    position: {
      id: `${previous.id}:playback:${boundedCursorMs}`,
      coordinates,
      timestamp: interpolateTimestamp(previous.timestamp, next.timestamp, ratio),
      recordedAt: new Date(boundedCursorMs).toISOString(),
      speedKph: previous.speedKph + (next.speedKph - previous.speedKph) * ratio,
      address: ratio < 0.5 ? previous.address : next.address,
    },
    headingDegrees: getBearingDegrees(previous.coordinates, next.coordinates),
    connected: true,
    isInterpolated: true,
    previousPointId: previous.id,
    nextPointId: next.id,
  };
}

export function getPlaybackTrail(track: VehicleTrack, cursorMs: number): VehicleTrackPoint[] {
  const frame = getPlaybackFrame(track, cursorMs);
  const trail = track.points.filter(
    (_point, index) => getTrackPointTimeMs(track, index) <= frame.cursorMs,
  );

  if (frame.connected && frame.isInterpolated) {
    return [...trail, frame.position];
  }

  return trail.length > 0 ? trail : [track.points[0]];
}

function frameAtPoint(track: VehicleTrack, index: number, cursorMs: number): PlaybackFrame {
  const point = track.points[index];
  const next = track.points[index + 1] ?? null;
  return {
    cursorMs,
    position: point,
    headingDegrees: next ? getBearingDegrees(point.coordinates, next.coordinates) : 0,
    connected: true,
    isInterpolated: false,
    previousPointId: point.id,
    nextPointId: next?.id ?? null,
  };
}

function getTrackPointTimeMs(track: VehicleTrack, index: number): number {
  const point = track.points[index];
  const recordedAt = point.recordedAt ? Date.parse(point.recordedAt) : Number.NaN;
  if (Number.isFinite(recordedAt)) {
    return recordedAt;
  }

  const firstMinutes = getTimestampMinutes(track.points[0].timestamp);
  const pointMinutes = getRelativeTimestampMinutes(point.timestamp, firstMinutes);
  const [year, month, day] = track.date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) + pointMinutes * 60_000;
}

function interpolateTimestamp(from: string, to: string, ratio: number): string {
  const startMinutes = getTimestampMinutes(from);
  const endMinutes = getRelativeTimestampMinutes(to, startMinutes);
  const valueMinutes = startMinutes + (endMinutes - startMinutes) * ratio;
  const totalSeconds = Math.round(valueMinutes * 60) % (24 * 60 * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function getSpeedColor(speedKph: number): TrackSpeedColor {
  if (speedKph < TRACK_SPEED_THRESHOLDS.yellowFromKph) return 'green';
  if (speedKph < TRACK_SPEED_THRESHOLDS.orangeFromKph) return 'yellow';
  if (speedKph < TRACK_SPEED_THRESHOLDS.redFromKph) return 'orange';
  if (speedKph >= TRACK_SPEED_THRESHOLDS.criticalFromKph) return 'critical';
  return 'red';
}

/** Bearing in degrees used to orient the moving playback arrow. */
export function getBearingDegrees(from: TrackCoordinates, to: TrackCoordinates): number {
  const [fromLon, fromLat] = from.map(toRadians);
  const [toLon, toLat] = to.map(toRadians);
  const deltaLon = toLon - fromLon;
  const bearing = Math.atan2(
    Math.sin(deltaLon) * Math.cos(toLat),
    Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon),
  );
  return ((((bearing * 180) / Math.PI + 360) % 360) + 360) % 360;
}

export function getPlaybackPosition(track: VehicleTrack, progress: number): VehicleTrackPoint {
  const bounded = Math.min(100, Math.max(0, progress));
  const start = getTimestampMinutes(track.points[0].timestamp);
  const finish = getRelativeTimestampMinutes(track.points.at(-1)!.timestamp, start);
  const target = start + ((finish - start) * bounded) / 100;

  return track.points.reduce((closest, point) => {
    const pointDistance = Math.abs(getRelativeTimestampMinutes(point.timestamp, start) - target);
    const closestDistance = Math.abs(
      getRelativeTimestampMinutes(closest.timestamp, start) - target,
    );
    return pointDistance <= closestDistance ? point : closest;
  });
}

export function getPlaybackHeading(track: VehicleTrack, progress: number): number {
  if (track.points.length < 2) return 0;
  const position = getPlaybackPosition(track, progress);
  const index = Math.min(
    track.points.length - 2,
    Math.max(
      0,
      track.points.findIndex((point) => point.id === position.id),
    ),
  );
  return getBearingDegrees(track.points[index].coordinates, track.points[index + 1].coordinates);
}

export function buildTrackViewModel(track: VehicleTrack, tripIndex = 0): VehicleTrackViewModel {
  if (track.points.length < 2) {
    throw new Error('Маршрут должен содержать минимум две точки');
  }

  const pointsById = new Map(track.points.map((point) => [point.id, point]));
  const measuredSpeeding: VehicleTrack['events'] = track.points
    .filter((point) => Number.isFinite(point.speedKph) && point.speedKph > 140)
    .map((point) => ({
      id: `${track.vehicleId}:${track.date}:overspeed:${point.id}`,
      type: 'speeding' as const,
      pointId: point.id,
      title: `Превышение · ${point.speedKph} км/ч`,
      description: 'Скорость выше порога мониторинга 140 км/ч.',
    }));
  const measuredAcceleration: VehicleTrack['events'] = track.events.some(
    (event) => event.type === 'harsh-acceleration',
  )
    ? []
    : detectHarshAcceleration(
        track.points.map((point, index) => ({
          id: point.id,
          recordedAt: new Date(getTrackPointTimeMs(track, index)),
          latitude: point.coordinates[1],
          longitude: point.coordinates[0],
          speedKph: point.speedKph,
        })),
        DEFAULT_ACCELERATION_DETECTOR_SETTINGS,
      ).map((event) => ({
        id: `${track.vehicleId}:${track.date}:acceleration:${event.startPointId}`,
        type: 'harsh-acceleration' as const,
        pointId: event.endPointId,
        title: event.severity === 'CRITICAL' ? 'Критически резкий разгон' : 'Резкий разгон',
        description: `Скорость выросла с ${Math.round(event.startSpeedKph)} до ${Math.round(event.endSpeedKph)} км/ч за ${Math.max(1, Math.round(event.durationMs / 1_000))} сек.`,
        metricLabel: `${Math.round(event.startSpeedKph)}→${Math.round(event.endSpeedKph)}`,
      }));
  const measuredBraking: VehicleTrack['events'] = track.events.some(
    (event) => event.type === 'harsh-braking',
  )
    ? []
    : detectHarshBraking(
        track.points.map((point, index) => ({
          id: point.id,
          recordedAt: new Date(getTrackPointTimeMs(track, index)),
          latitude: point.coordinates[1],
          longitude: point.coordinates[0],
          speedKph: point.speedKph,
        })),
        DEFAULT_BRAKING_DETECTOR_SETTINGS,
      ).map((event) => ({
        id: `${track.vehicleId}:${track.date}:braking:${event.startPointId}`,
        type: 'harsh-braking' as const,
        pointId: event.endPointId,
        title: event.severity === 'CRITICAL' ? 'Критически резкое торможение' : 'Резкое торможение',
        description: `Скорость снизилась с ${Math.round(event.startSpeedKph)} до ${Math.round(event.endSpeedKph)} км/ч за ${Math.max(1, Math.round(event.durationMs / 1_000))} сек.`,
        metricLabel: `${Math.round(event.startSpeedKph)}→${Math.round(event.endSpeedKph)}`,
      }));
  const events = [
    ...track.events.filter((event) => event.type !== 'speeding'),
    ...measuredSpeeding,
    ...measuredAcceleration,
    ...measuredBraking,
  ].map((event) => {
    const point = pointsById.get(event.pointId);

    if (!point && (!event.coordinates || !event.timestamp)) {
      throw new Error('Событие не привязано к точке маршрута');
    }

    return toEventView(event, point, track.date, tripIndex);
  });

  const eventGroups = groupEventsByCoordinates(events);
  const start = track.points[0];
  const finish = track.points[track.points.length - 1];

  return {
    vehicleId: track.vehicleId,
    date: track.date,
    tripId: track.date,
    tripIndex,
    segments: buildSegments(track.points, track.date, tripIndex),
    events,
    eventGroups,
    start,
    finish,
    distanceKm: calculateDistanceKm(track.points),
    durationMinutes: getDurationMinutes(start.timestamp, finish.timestamp),
    maxSpeedKph: Math.max(...track.points.map((point) => point.speedKph)),
    stopsCount: events.filter((event) => event.type === 'stop').length,
  };
}

export function buildTrackPeriodViewModel(
  tracks: readonly VehicleTrack[],
  period: TrackPeriodMode,
): VehicleTrackPeriodViewModel {
  if (tracks.length === 0) {
    throw new Error('Период маршрута должен содержать минимум одну поездку');
  }

  const trips = [...tracks]
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((track, tripIndex) => buildTrackViewModel(track, tripIndex));
  const activeTrip = trips[0];

  return {
    vehicleId: activeTrip.vehicleId,
    period,
    date: activeTrip.date,
    trips,
    activeTrip,
    segments: trips.flatMap((trip) => trip.segments),
    events: trips.flatMap((trip) => trip.events),
    eventGroups: trips.flatMap((trip) => trip.eventGroups),
    start: activeTrip.start,
    finish: activeTrip.finish,
    distanceKm: trips.reduce((total, trip) => total + trip.distanceKm, 0),
    durationMinutes: trips.reduce((total, trip) => total + trip.durationMinutes, 0),
    maxSpeedKph: Math.max(...trips.map((trip) => trip.maxSpeedKph)),
    stopsCount: trips.reduce((total, trip) => total + trip.stopsCount, 0),
  };
}

export function buildTrackActivitySections(
  segments: readonly VehicleTrackSegment[],
): readonly VehicleTrackActivitySection[] {
  const groups: VehicleTrackSegment[][] = [];

  for (const segment of segments) {
    const previousGroup = groups.at(-1);
    const previousSegment = previousGroup?.at(-1);
    const sameActivity =
      previousSegment &&
      getActivityKind(previousSegment) === getActivityKind(segment) &&
      previousSegment.tripId === segment.tripId &&
      previousSegment.to.id === segment.from.id;

    if (sameActivity && previousGroup) previousGroup.push(segment);
    else groups.push([segment]);
  }

  return groups.map((group) => {
    const first = group[0];
    const last = group[group.length - 1];
    const durations = group.map((segment) =>
      Math.max(0, getDurationMinutes(segment.from.timestamp, segment.to.timestamp)),
    );
    const durationMinutes = durations.reduce((total, duration) => total + duration, 0);
    const weightedSpeed = group.reduce(
      (total, segment, index) => total + segment.speedKph * durations[index],
      0,
    );

    return {
      id: `${first.tripId}:activity:${first.id}:${getActivityKind(first)}`,
      kind: getActivityKind(first),
      tripId: first.tripId,
      tripIndex: first.tripIndex,
      from: first.from,
      to: last.to,
      segments: group,
      segmentIds: group.map((segment) => segment.id),
      durationMinutes,
      distanceKm: group.reduce(
        (total, segment) =>
          total + getDistanceBetween(segment.from.coordinates, segment.to.coordinates),
        0,
      ),
      averageSpeedKph:
        durationMinutes > 0
          ? Math.round(weightedSpeed / durationMinutes)
          : Math.round(
              group.reduce((total, segment) => total + segment.speedKph, 0) / group.length,
            ),
      maxSpeedKph: Math.max(...group.map((segment) => segment.speedKph)),
      address: last.to.address || first.from.address,
    };
  });
}

function getActivityKind(segment: VehicleTrackSegment): TrackActivityKind {
  if (segment.speedKph === 0) return 'stopped';
  if (segment.speedKph > 140) return 'speeding';
  return 'moving';
}

function buildSegments(
  points: readonly VehicleTrackPoint[],
  tripId: string,
  tripIndex: number,
): readonly VehicleTrackSegment[] {
  return points.slice(1).flatMap((to, index) => {
    const from = points[index];
    if (!isConnectedPointPair(from, to)) return [];

    return [
      {
        id: `${from.id}-${to.id}`,
        tripId,
        tripIndex,
        from,
        to,
        speedKph: to.speedKph,
        color: getSpeedColor(to.speedKph),
        opacity: 0.72 as const,
      },
    ];
  });
}

function toEventView(
  event: VehicleTrack['events'][number],
  point: VehicleTrackPoint | undefined,
  tripId: string,
  tripIndex: number,
): VehicleTrackEventView {
  return {
    ...event,
    tripId,
    tripIndex,
    coordinates: event.coordinates ?? point!.coordinates,
    timestamp: event.timestamp ?? point!.timestamp,
    speedKph: event.speedKph ?? point?.speedKph ?? 0,
    address: event.address ?? point?.address ?? 'Адрес не указан',
  };
}

function groupEventsByCoordinates(
  events: readonly VehicleTrackEventView[],
): readonly (VehicleTrackEventView & { count: number })[] {
  const groups = new Map<string, VehicleTrackEventView & { count: number }>();

  for (const event of events) {
    const key = event.type === 'speeding' ? event.id : event.coordinates.join(',');
    const group = groups.get(key);

    if (group) {
      group.count += 1;
    } else {
      groups.set(key, { ...event, count: 1 });
    }
  }

  return [...groups.values()];
}

function calculateDistanceKm(points: readonly VehicleTrackPoint[]): number {
  return points.slice(1).reduce((distanceKm, point, index) => {
    const previous = points[index];
    return (
      distanceKm +
      (isConnectedPointPair(previous, point)
        ? getDistanceBetween(previous.coordinates, point.coordinates)
        : 0)
    );
  }, 0);
}

function isConnectedPointPair(from: VehicleTrackPoint, to: VehicleTrackPoint) {
  return getDurationMinutes(from.timestamp, to.timestamp) * 60_000 <= MAX_TRACK_POINT_GAP_MS;
}

function getDistanceBetween(from: TrackCoordinates, to: TrackCoordinates): number {
  const [fromLongitude, fromLatitude] = from;
  const [toLongitude, toLatitude] = to;
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const fromLatitudeRadians = toRadians(fromLatitude);
  const toLatitudeRadians = toRadians(toLatitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitudeRadians) * Math.cos(toLatitudeRadians) * Math.sin(longitudeDelta / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function getDurationMinutes(startTimestamp: string, finishTimestamp: string): number {
  const start = getTimestampMinutes(startTimestamp);
  const finish = getTimestampMinutes(finishTimestamp);

  return finish >= start ? finish - start : finish + 24 * 60 - start;
}

function getTimestampMinutes(timestamp: string): number {
  const [hours = 0, minutes = 0, seconds = 0] = timestamp.split(':').map(Number);

  return hours * 60 + minutes + seconds / 60;
}

function getRelativeTimestampMinutes(timestamp: string, start: number) {
  const value = getTimestampMinutes(timestamp);
  return value < start ? value + 24 * 60 : value;
}
