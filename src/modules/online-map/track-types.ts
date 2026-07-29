export type TrackCoordinates = readonly [longitude: number, latitude: number];

export type TrackEventType =
  'stop' | 'refuel' | 'speeding' | 'connection-loss' | 'geofence-enter' | 'geofence-exit';

export type TrackSpeedColor = 'green' | 'yellow' | 'red';

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
  from: VehicleTrackPoint;
  to: VehicleTrackPoint;
  speedKph: number;
  color: TrackSpeedColor;
  opacity: 0.72;
}

export interface VehicleTrackEventView extends VehicleTrackEvent {
  coordinates: TrackCoordinates;
  timestamp: string;
  speedKph: number;
  address: string;
}

export interface VehicleTrackViewModel {
  vehicleId: string;
  date: string;
  segments: readonly VehicleTrackSegment[];
  events: readonly VehicleTrackEventView[];
  eventGroups: readonly (VehicleTrackEventView & { count: number })[];
  start: VehicleTrackPoint;
  finish: VehicleTrackPoint;
  distanceKm: number;
  durationMinutes: number;
  maxSpeedKph: number;
}
