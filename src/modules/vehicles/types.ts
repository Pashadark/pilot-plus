export type VehicleStatus = 'MOVING' | 'IDLE' | 'OFFLINE' | 'MAINTENANCE' | 'UNKNOWN';
export type VehicleFuelType = 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'OTHER';

export interface VehicleTelemetrySummary {
  odometerKm: number | null;
  fuelLevelPercent: number | null;
  lastSeenAt: string | null;
  lastTripAt: string | null;
  hasPosition: boolean;
}

export interface VehicleImageDto {
  localPath: string;
  alt: string;
}

export interface VehicleOptionDto {
  id: string;
  label: string;
  image: VehicleImageDto | null;
}

export interface VehicleCardDto {
  id: string;
  internalNumber: string;
  model: string;
  city: string;
  office: string | null;
  registrationNumber: string | null;
  transmission: string;
  engineLiters: number | null;
  fuelType: VehicleFuelType;
  seats: number;
  dailyPriceMinor: number;
  currency: string;
  originalPrice: string;
  features: string[];
  status: VehicleStatus;
  primaryImage: VehicleImageDto | null;
  telemetry: VehicleTelemetrySummary;
}

export interface VehicleTripDto {
  id: string;
  startedAt: string;
  endedAt: string | null;
  distanceKm: number | null;
  durationSeconds: number | null;
}

export interface VehicleEventDto {
  id: string;
  title: string;
  severity: 'INFO' | 'WARNING' | 'DANGER';
  description: string | null;
  recordedAt: string;
}

export type VehicleMaintenanceKind =
  'OIL' | 'FILTERS' | 'BRAKES' | 'TIRES' | 'TIMING' | 'INSPECTION' | 'OTHER';

export type VehicleMaintenanceStatus =
  'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';

export interface VehicleMaintenanceHistorySummary {
  id: string;
  title: string;
  kind: VehicleMaintenanceKind;
  status: VehicleMaintenanceStatus;
  scheduledAt: string | null;
  completedAt: string | null;
  targetOdometerKm: number | null;
  provider: string | null;
  costMinor: number | null;
}

export type VehicleWashKind = 'BODY' | 'COMPLEX' | 'INTERIOR' | 'MATS' | 'ENGINE' | 'OTHER';
export type VehicleWashStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface VehicleWashHistorySummary {
  id: string;
  kind: VehicleWashKind;
  status: VehicleWashStatus;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  provider: string | null;
  costMinor: number | null;
}

export interface VehicleDetailDto extends VehicleCardDto {
  vin: string | null;
  createdAt: string;
  trips: VehicleTripDto[];
  events: VehicleEventDto[];
  fuelRecords: { id: string; recordedAt: string; volumeLiters: number | null }[];
  maintenanceRecords: VehicleMaintenanceHistorySummary[];
  washRecords: VehicleWashHistorySummary[];
  documents: { id: string; title: string; type: string; expiresAt: string | null }[];
}
