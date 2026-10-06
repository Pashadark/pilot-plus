import type {
  TrackCoordinates,
  TrackPeriodMode,
  TrackActivityKind,
  TrackSpeedColor,
  VehicleTrack,
  VehicleTrackEventView,
  VehicleTrackPoint,
  VehicleTrackPeriodViewModel,
  VehicleTrackSegment,
  VehicleTrackActivitySection,
  VehicleTrackViewModel,
} from './track-types';
import { MAX_TRACK_POINT_GAP_MS, TRACK_SPEED_THRESHOLDS } from './track-types';

const EARTH_RADIUS_KM = 6371;

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
    Math.cos(fromLat) * Math.sin(toLat) -
      Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon),
  );
  return (((bearing * 180) / Math.PI + 360) % 360 + 360) % 360;
}

export function getPlaybackPosition(track: VehicleTrack, progress: number): VehicleTrackPoint {
  const bounded = Math.min(100, Math.max(0, progress));
  const index = Math.round((bounded / 100) * (track.points.length - 1));

  return track.points[index];
}

export function getPlaybackHeading(track: VehicleTrack, progress: number): number {
  if (track.points.length < 2) return 0;
  const bounded = Math.min(100, Math.max(0, progress));
  const index = Math.min(track.points.length - 2, Math.round((bounded / 100) * (track.points.length - 1)));
  return getBearingDegrees(track.points[index].coordinates, track.points[index + 1].coordinates);
}

export function buildTrackViewModel(track: VehicleTrack, tripIndex = 0): VehicleTrackViewModel {
  if (track.points.length < 2) {
    throw new Error('Маршрут должен содержать минимум две точки');
  }

  const pointsById = new Map(track.points.map((point) => [point.id, point]));
  const measuredSpeeding: VehicleTrack['events'] = track.points.filter(point => Number.isFinite(point.speedKph) && point.speedKph > 140).map(point => ({
    id: `${track.vehicleId}:${track.date}:overspeed:${point.id}`,
    type: 'speeding' as const, pointId: point.id,
    title: `Превышение · ${point.speedKph} км/ч`,
    description: 'Скорость выше порога мониторинга 140 км/ч.',
  }));
  const events = [...track.events.filter(event => event.type !== 'speeding'), ...measuredSpeeding].map((event) => {
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
          : Math.round(group.reduce((total, segment) => total + segment.speedKph, 0) / group.length),
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
  const [hours, minutes] = timestamp.split(':').map(Number);

  return hours * 60 + minutes;
}
