import type { VehicleGpsStatusView } from '@/modules/vehicles/gps-status';

export type OnlineMapFilter = 'all' | 'in-park' | 'moving' | 'idle' | 'offline' | 'no-data';

export interface OnlineMapVehicle {
  id: string;
  name: string;
  plate: string;
  image?: { src: string; alt: string } | null;
  gpsStatus: VehicleGpsStatusView;
  longitude: number | null;
  latitude: number | null;
  speedKph: number;
  heading?: number | null;
  fuelPercent: number | null;
  odometerKm?: number | null;
  dailyDistanceKm?: number | null;
  includedMileageKm?: number | null;
  maintenance?: {
    startOdometerKm: number | null;
    targetOdometerKm: number;
    remainingKm: number | null;
    status?: 'PLANNED' | 'IN_PROGRESS' | 'OVERDUE';
  } | null;
  recordedAt?: string | null;
  lastSeenLabel: string;
  address: string;
  currentRental?: {
    id: string;
    clientId?: string;
    contractNumber: string | null;
    clientName: string;
    endsAt?: string;
    dailyRateMinor?: number;
    currency?: string;
    includedMileageKm?: number | null;
    canAccessDetails?: boolean;
    depositState?:
      'NOT_COLLECTED' | 'COLLECTED' | 'RETURNED' | 'PARTIALLY_WITHHELD' | 'WITHHELD' | null;
  } | null;
}
