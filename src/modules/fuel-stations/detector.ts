export interface FuelStation {
  id: string;
  name: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
}

export interface FuelStationPosition {
  vehicleId: string;
  latitude: number;
  longitude: number;
  recordedAt: Date;
  accuracyMeters?: number | null;
}

export interface FuelStationVisitState {
  stationId: string;
  enteredAt: Date;
  lastSeenAt: Date;
  notifiedAt: Date | null;
}

export type DetectorResult =
  | { kind: 'outside'; state: null }
  | { kind: 'entered' | 'dwellPending' | 'possibleRefuelling'; state: FuelStationVisitState; station: FuelStation }
  | { kind: 'exited'; state: null; stationId: string };

const DEFAULT_OPTIONS = { radiusMeters: 150, dwellMinutes: 7, maxPositionAgeMinutes: 10, maxAccuracyMeters: 150 };

export function evaluateFuelStationPosition(
  position: FuelStationPosition,
  state: FuelStationVisitState | null,
  stations: readonly FuelStation[],
  now: Date,
  options: Partial<typeof DEFAULT_OPTIONS> = {},
): DetectorResult {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const ageMs = now.getTime() - position.recordedAt.getTime();
  if (ageMs < -60_000 || ageMs > config.maxPositionAgeMinutes * 60_000) {
    return state ? { kind: 'dwellPending', state, station: stations.find((item) => item.id === state.stationId) ?? stations[0] } : { kind: 'outside', state: null };
  }
  if (position.accuracyMeters != null && position.accuracyMeters > config.maxAccuracyMeters) {
    return state ? { kind: 'dwellPending', state, station: stations.find((item) => item.id === state.stationId) ?? stations[0] } : { kind: 'outside', state: null };
  }
  const station = stations.find((item) => haversineMeters(position.latitude, position.longitude, item.latitude, item.longitude) <= config.radiusMeters);
  if (!station) return state ? { kind: 'exited', state: null, stationId: state.stationId } : { kind: 'outside', state: null };
  if (!state || state.stationId !== station.id) {
    const nextState = { stationId: station.id, enteredAt: position.recordedAt, lastSeenAt: position.recordedAt, notifiedAt: null };
    return { kind: 'entered', state: nextState, station };
  }
  const nextState = { ...state, lastSeenAt: position.recordedAt };
  if (!state.notifiedAt && position.recordedAt.getTime() - state.enteredAt.getTime() >= config.dwellMinutes * 60_000) {
    nextState.notifiedAt = position.recordedAt;
    return { kind: 'possibleRefuelling', state: nextState, station };
  }
  return { kind: 'dwellPending', state: nextState, station };
}

export function haversineMeters(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(latitudeB - latitudeA);
  const dLon = radians(longitudeB - longitudeA);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
