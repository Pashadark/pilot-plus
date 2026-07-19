export type VehicleStatus = 'moving' | 'idle' | 'offline' | 'alarm';

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  speedKph: number;
  status: VehicleStatus;
  longitude: number;
  latitude: number;
  lastSeenLabel: string;
  fuelPercent: number;
  mileageKm: number;
}

export interface FleetStat {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: 'primary' | 'success' | 'warning' | 'danger';
  icon: 'vehicle' | 'activity' | 'pause' | 'signal' | 'mileage' | 'fuel';
}

export interface FleetEvent {
  id: string;
  title: string;
  vehicleName: string;
  timeLabel: string;
  tone: 'info' | 'warning' | 'danger';
}

export interface MileagePoint {
  label: string;
  value: number;
}

export interface FuelSlice {
  label: string;
  value: number;
  percent: number;
  tone: 'primary' | 'success' | 'danger';
}
