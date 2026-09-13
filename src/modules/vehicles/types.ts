import type { VehicleGpsStatusView } from './gps-status';

export type VehicleStatus = 'MOVING' | 'IDLE' | 'OFFLINE' | 'MAINTENANCE' | 'UNKNOWN';
export type VehicleFuelType = 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'OTHER';

export interface VehicleTelemetrySummary {
  odometerKm: number | null;
  fuelLevelPercent: number | null;
  speedKph?: number | null;
  lastSeenAt: string | null;
  lastTripAt: string | null;
  hasPosition: boolean;
  address: string | null;
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
  gpsStatus: VehicleGpsStatusView;
  primaryImage: VehicleImageDto | null;
  activeRental?: {
    id: string;
    contractNumber: string | null;
    clientName: string;
    endsAt: string;
  } | null;
  telemetry: VehicleTelemetrySummary;
  popularityRank?: 1 | 2 | 3 | null;
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
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'DAMAGE_REPORTED'
  | 'WAITING_REPAIR';

export interface VehicleMaintenanceHistorySummary {
  id: string;
  title: string;
  recordType?: 'MAINTENANCE' | 'REPAIR';
  description?: string | null;
  kind: VehicleMaintenanceKind;
  status: VehicleMaintenanceStatus;
  scheduledAt: string | null;
  damageReportedAt?: string | null;
  startedAt?: string | null;
  completedAt: string | null;
  targetOdometerKm: number | null;
  provider: string | null;
  costMinor: number | null;
  rental?: { id: string; contractNumber: string | null } | null;
  client?: { id: string; fullName: string } | null;
  workItems?: { id: string; title: string; description: string | null; costMinor: number | null }[];
  attachments?: {
    id: string;
    kind: 'DAMAGE_BEFORE' | 'REPAIR_AFTER' | 'DOCUMENT' | 'RECEIPT';
    originalName: string;
    url: string;
    isImage: boolean;
  }[];
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
  currentRentalId?: string | null;
  galleryImages?: VehicleImageDto[];
  trips: VehicleTripDto[];
  events: VehicleEventDto[];
  fuelRecords: { id: string; recordedAt: string; volumeLiters: number | null }[];
  maintenanceRecords: VehicleMaintenanceHistorySummary[];
  washRecords: VehicleWashHistorySummary[];
  documents: {
    id: string;
    title: string;
    type: string;
    expiresAt: string | null;
    originalName: string | null;
    hasFile: boolean;
  }[];
  rentals?: {
    id: string;
    contractNumber: string | null;
    status: 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    startsAt: string;
    endsAt: string;
    client: { id: string; fullName: string };
    drivers?: { id: string; fullName: string }[];
    documents: { id: string; version: number; format: 'DOCX' | 'PDF' }[];
    operations: {
      id: string;
      type: 'HANDOVER' | 'EXTENSION' | 'RETURN';
      occurredAt: string;
      mileageKm: number | null;
      fuelLevelPercent: number | null;
      evidenceStatus: 'COMPLETE' | 'VIDEO_MISSING' | 'DASHBOARD_PHOTO_MISSING' | 'MISSING';
    }[];
  }[];
}
