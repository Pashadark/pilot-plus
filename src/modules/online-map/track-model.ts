import { vehicleTrackFixtures } from './track-fixtures';
import type {
  TrackCoordinates,
  TrackPeriodMode,
  TrackSpeedColor,
  VehicleTrack,
  VehicleTrackEventView,
  VehicleTrackPoint,
  VehicleTrackPeriodViewModel,
  VehicleTrackSegment,
  VehicleTrackViewModel,
} from './track-types';

const EARTH_RADIUS_KM = 6371;

export function getSpeedColor(speedKph: number): TrackSpeedColor {
  if (speedKph < 40) return 'green';
  if (speedKph < 70) return 'yellow';
  return 'red';
}

export function getVehicleTrackDates(vehicleId: string): readonly string[] {
  return vehicleTrackFixtures
    .filter((track) => track.vehicleId === vehicleId)
    .map((track) => track.date)
    .sort((left, right) => right.localeCompare(left));
}

export function getVehicleTrack(vehicleId: string, date: string): VehicleTrack | null {
  return (
    vehicleTrackFixtures.find((track) => track.vehicleId === vehicleId && track.date === date) ??
    null
  );
}

export function getVehicleTracks(
  vehicleId: string,
  dates: readonly string[],
): readonly VehicleTrack[] {
  const requestedDates = new Set(dates);

  return vehicleTrackFixtures
    .filter((track) => track.vehicleId === vehicleId && requestedDates.has(track.date))
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function getPlaybackPosition(track: VehicleTrack, progress: number): VehicleTrackPoint {
  const bounded = Math.min(100, Math.max(0, progress));
  const index = Math.round((bounded / 100) * (track.points.length - 1));

  return track.points[index];
}

export function buildTrackViewModel(track: VehicleTrack, tripIndex = 0): VehicleTrackViewModel {
  if (track.points.length < 2) {
    throw new Error('Маршрут должен содержать минимум две точки');
  }

  const pointsById = new Map(track.points.map((point) => [point.id, point]));
  const events = track.events.map((event) => {
    const point = pointsById.get(event.pointId);

    if (!point) {
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

function buildSegments(
  points: readonly VehicleTrackPoint[],
  tripId: string,
  tripIndex: number,
): readonly VehicleTrackSegment[] {
  return points.slice(1).map((to, index) => ({
    id: `${points[index].id}-${to.id}`,
    tripId,
    tripIndex,
    from: points[index],
    to,
    speedKph: to.speedKph,
    color: getSpeedColor(to.speedKph),
    opacity: 0.72,
  }));
}

function toEventView(
  event: VehicleTrack['events'][number],
  point: VehicleTrackPoint,
  tripId: string,
  tripIndex: number,
): VehicleTrackEventView {
  return {
    ...event,
    tripId,
    tripIndex,
    coordinates: point.coordinates,
    timestamp: point.timestamp,
    speedKph: point.speedKph,
    address: point.address,
  };
}

function groupEventsByCoordinates(
  events: readonly VehicleTrackEventView[],
): readonly (VehicleTrackEventView & { count: number })[] {
  const groups = new Map<string, VehicleTrackEventView & { count: number }>();

  for (const event of events) {
    const key = event.coordinates.join(',');
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
    return distanceKm + getDistanceBetween(points[index].coordinates, point.coordinates);
  }, 0);
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
