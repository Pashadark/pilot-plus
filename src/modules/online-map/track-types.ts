export type TrackCoordinates = readonly [longitude: number, latitude: number];

export type TrackEventType =
  'stop' | 'refuel' | 'speeding' | 'connection-loss' | 'geofence-enter' | 'geofence-exit';

export type TrackSpeedColor = 'green' | 'yellow' | 'red';
export type TrackPeriodMode = 'day' | 'seven-days';

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
}

export interface VehicleTrack {
  vehicleId: string;
  date: string;
  points: readonly VehicleTrackPoint[];
  events: readonly VehicleTrackEvent[];
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
