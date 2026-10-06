export type TrackCoordinates = readonly [longitude: number, latitude: number];

export type TrackEventType =
  | 'stop'
  | 'refuel'
  | 'speeding'
  | 'fine'
  | 'connection-loss'
  | 'geofence-enter'
  | 'geofence-exit';

export type TrackSpeedColor = 'green' | 'yellow' | 'orange' | 'red' | 'critical';
export type TrackActivityKind = 'stopped' | 'moving' | 'speeding';
export type TrackPeriodMode = 'day' | 'seven-days';
export type TrackFineLocationSource = 'exact' | 'time-inferred' | 'unmapped';

export const TRACK_SPEED_THRESHOLDS = {
  yellowFromKph: 40,
  orangeFromKph: 70,
  redFromKph: 100,
  criticalFromKph: 120,
} as const;

export const MAX_TRACK_POINT_GAP_MS = 20 * 60 * 1_000;

export interface VehicleTrackPoint {
  id: string;
  coordinates: TrackCoordinates;
  timestamp: string;
  speedKph: number;
  address: string;
}

export interface VehicleTrackEvent {
  id: string;
  type: TrackEventType;
  pointId: string;
  title: string;
  description: string;
  coordinates?: TrackCoordinates;
  timestamp?: string;
  speedKph?: number;
  address?: string;
  fine?: OnlineMapTrackFine;
}

export interface VehicleTrack {
  vehicleId: string;
  date: string;
  points: readonly VehicleTrackPoint[];
  events: readonly VehicleTrackEvent[];
}

export interface OnlineMapTrackFine {
  id: string;
  decreeNumber: string;
  offenseAt: string;
  coordinates: TrackCoordinates | null;
  pointId: string | null;
  locationSource: TrackFineLocationSource;
  amountMinor: number;
  status: string;
  description: string | null;
  address: string | null;
  rentalId: string | null;
  contractNumber: string | null;
  clientId: string | null;
  clientName: string | null;
}

export interface OnlineMapTrackHistoryDto {
  vehicleId: string;
  from: string;
  to: string;
  availableDates: readonly string[];
  tracks: readonly VehicleTrack[];
  fines: readonly OnlineMapTrackFine[];
}

export interface VehicleTrackSegment {
  id: string;
  tripId: string;
  tripIndex: number;
  from: VehicleTrackPoint;
  to: VehicleTrackPoint;
  speedKph: number;
  color: TrackSpeedColor;
  opacity: 0.72;
}

export interface VehicleTrackActivitySection {
  id: string;
  kind: TrackActivityKind;
  tripId: string;
  tripIndex: number;
  from: VehicleTrackPoint;
  to: VehicleTrackPoint;
  segments: readonly VehicleTrackSegment[];
  segmentIds: readonly string[];
  durationMinutes: number;
  distanceKm: number;
  averageSpeedKph: number;
  maxSpeedKph: number;
  address: string;
}

export interface VehicleTrackEventView extends VehicleTrackEvent {
  tripId: string;
  tripIndex: number;
  coordinates: TrackCoordinates;
  timestamp: string;
  speedKph: number;
  address: string;
}

export interface VehicleTrackViewModel {
  vehicleId: string;
  date: string;
  tripId: string;
  tripIndex: number;
  segments: readonly VehicleTrackSegment[];
  events: readonly VehicleTrackEventView[];
  eventGroups: readonly (VehicleTrackEventView & { count: number })[];
  start: VehicleTrackPoint;
  finish: VehicleTrackPoint;
  distanceKm: number;
  durationMinutes: number;
  maxSpeedKph: number;
  stopsCount: number;
}

export interface VehicleTrackPeriodViewModel {
  vehicleId: string;
  period: TrackPeriodMode;
  date: string;
  trips: readonly VehicleTrackViewModel[];
  activeTrip: VehicleTrackViewModel;
  segments: readonly VehicleTrackSegment[];
  events: readonly VehicleTrackEventView[];
  eventGroups: readonly (VehicleTrackEventView & { count: number })[];
  start: VehicleTrackPoint;
  finish: VehicleTrackPoint;
  distanceKm: number;
  durationMinutes: number;
  maxSpeedKph: number;
  stopsCount: number;
}
