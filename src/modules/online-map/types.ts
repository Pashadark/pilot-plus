import type { VehicleGpsStatusView } from '@/modules/vehicles/gps-status';

export type OnlineMapFilter = 'all' | 'in-park' | 'moving' | 'idle' | 'offline' | 'no-data';

export interface OnlineMapVehicle {
  id: string;
  name: string;
  plate: string;
  gpsStatus: VehicleGpsStatusView;
  longitude: number | null;
  latitude: number | null;
  speedKph: number;
  fuelPercent: number | null;
  recordedAt?: string | null;
  lastSeenLabel: string;
  address: string;
  currentRental?: {
    id: string;
    contractNumber: string | null;
    clientName: string;
  } | null;
}
