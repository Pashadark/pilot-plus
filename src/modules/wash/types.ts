export type WashStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type WashKind = 'BODY' | 'COMPLEX' | 'INTERIOR' | 'MATS' | 'ENGINE' | 'OTHER';

export type OperationActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
};

export type WashInput = {
  vehicleId: string;
  kind: WashKind;
  scheduledAt: Date;
  provider: string | null;
  costMinor: number | null;
  notes: string | null;
};

export type WashInputResult =
  { ok: true; data: WashInput } | { ok: false; state: OperationActionState };
