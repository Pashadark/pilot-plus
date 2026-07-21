export type MaintenanceStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';

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
