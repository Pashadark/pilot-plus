export type BookingClientOption = {
  id: string;
  companyId: string;
  fullName: string;
  phone: string | null;
  documentsReady: boolean;
};

export type BookingVehicleOption = {
  id: string;
  label: string;
  registrationNumber: string | null;
  imageUrl: string | null;
  dailyMinor: number;
  depositMinor: number;
  legalReady: boolean;
  available: boolean;
  reasons: string[];
  rentalIntervals: Array<{
    startsAt: string;
    endsAt: string;
    status: 'CONFIRMED' | 'ACTIVE';
  }>;
};

export type BookingWorkspaceData = {
  companyId: string;
  templateVersionId: string | null;
  clients: BookingClientOption[];
  vehicles: BookingVehicleOption[];
};

export type BookingActionState =
  | {
      ok: true;
      rentalId: string;
      contractNumber?: string;
      documentVersion?: number;
    }
  | {
      ok: false;
      code:
        | 'VALIDATION'
        | 'VEHICLE_UNAVAILABLE'
        | 'DOCUMENT_FAILED'
        | 'RECEIPT_FAILED'
        | 'FORBIDDEN'
        | 'SAVE_FAILED';
      message: string;
      fieldErrors?: Record<string, string>;
      rentalId?: string;
    };
