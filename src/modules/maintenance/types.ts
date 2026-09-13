export type MaintenanceStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'DAMAGE_REPORTED'
  | 'WAITING_REPAIR';

export type MaintenanceRecordType = 'MAINTENANCE' | 'REPAIR';

export type MaintenanceKind =
  'OIL' | 'FILTERS' | 'BRAKES' | 'TIRES' | 'TIMING' | 'INSPECTION' | 'OTHER';

export type OperationActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
};

export type MaintenanceInput = {
  vehicleId: string;
  title: string;
  kind: MaintenanceKind;
  scheduledAt: Date;
  targetOdometerKm: number | null;
  provider: string | null;
  costMinor: number | null;
  notes: string | null;
};

export type MaintenanceInputResult =
  { ok: true; data: MaintenanceInput } | { ok: false; state: OperationActionState };

export type RepairStatus = 'DAMAGE_REPORTED' | 'WAITING_REPAIR' | 'IN_PROGRESS';

export type RepairWorkItemInput = {
  title: string;
  description: string | null;
  costMinor: number | null;
};

export type RepairInput = {
  vehicleId: string;
  title: string;
  status: RepairStatus;
  damageReportedAt: Date;
  rentalId: string | null;
  odometerKm: number | null;
  provider: string | null;
  costMinor: number | null;
  description: string | null;
  notes: string | null;
  workItems: RepairWorkItemInput[];
};

export type RepairInputResult =
  | { ok: true; data: RepairInput }
  | { ok: false; state: OperationActionState };
