import type { ClientStatus as PrismaClientStatus } from '@/database/generated/prisma';

export type ClientStatus = PrismaClientStatus;

export type ClientInput = {
  companyId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthDate: Date | null;
  phone: string | null;
  additionalPhone: string | null;
  email: string | null;
  passport: string | null;
  registrationAddress: string | null;
  actualAddress: string | null;
  driverLicense: string | null;
  driverLicenseIssuedAt: Date | null;
  driverLicenseExpiresAt: Date | null;
  status: ClientStatus;
};

export type ClientInputResult =
  { ok: true; data: ClientInput } | { ok: false; fieldErrors: Record<string, string> };

export type ClientListRentalSummary = {
  id: string;
  contractNumber: string | null;
  status: 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startsAt: string;
  endsAt: string;
  vehicle: { label: string; registrationNumber: string | null };
  totalPriceMinor: string;
  depositMinor: string | null;
  depositStatus:
    'NOT_COLLECTED' | 'COLLECTED' | 'RETURNED' | 'PARTIALLY_WITHHELD' | 'WITHHELD' | null;
  depositReturnedAt: string | null;
};

export type ClientCardDto = {
  id: string;
  companyId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  additionalPhone?: string | null;
  phoneMasked: string;
  passportMasked: string | null;
  driverLicenseMasked: string | null;
  driverLicenseExpiresAt: string | null;
  status: ClientStatus;
  updatedAt: string;
  localPhotoUrl: string | null;
  telegramUrl: string | null;
  fineSummary: {
    total: number;
    paidAmountMinor: string;
  };
  rentalSummary: {
    total: number;
    active: number;
    current: ClientListRentalSummary | null;
    last: ClientListRentalSummary | null;
  };
};

export type ClientDetailDto = ClientCardDto & {
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthDate: string | null;
  phone: string | null;
  passport: string | null;
  passportSeries?: string;
  passportNumber?: string;
  passportIssuedBy?: string;
  passportIssuedAt?: string;
  passportDivisionCode?: string;
  registrationAddress?: string | null;
  actualAddress?: string | null;
  driverLicense: string | null;
  driverLicenseIssuedAt: string | null;
  createdAt: string;
};

export type ClientQueryFilters = {
  q?: string;
  status?: ClientStatus;
  documents?: 'present' | 'missing';
  license?: 'present' | 'missing';
  renting?: 'active';
  page?: number;
  pageSize?: number;
};

export type ClientListResult = {
  items: ClientCardDto[];
  page: number;
  pageSize: number;
};

export type ClientActionState =
  | { status: 'idle' }
  | { status: 'success'; message: string; clientId: string }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

export type ClientRentalWorkspaceDto = {
  summary: { total: number; active: number; completed: number; totalMinor: string };
  rentals: Array<{
    id: string;
    contractNumber: string | null;
    status: 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    startsAt: string;
    endsAt: string;
    billableDays: number;
    totalPriceMinor: string;
    depositMinor: string;
    currency: string;
    vehicle: { label: string; registrationNumber: string | null };
    documents: Array<{ version: number; format: 'DOCX' | 'PDF' }>;
    operations: Array<{
      id: string;
      type: 'HANDOVER' | 'EXTENSION' | 'RETURN';
      occurredAt: string;
      mileageKm: number | null;
      fuelLevelPercent: number | null;
      evidenceStatus: 'COMPLETE' | 'VIDEO_MISSING' | 'DASHBOARD_PHOTO_MISSING' | 'MISSING';
      evidenceMissingReason: string | null;
      actorName: string;
    }>;
  }>;
};

export type ClientFineWorkspaceDto = {
  summary: { total: number; unpaid: number; unpaidAmountMinor: string };
  fines: Array<{
    id: string;
    decreeNumber: string;
    decreeAt: string | null;
    offenseAt: string;
    currentAmountMinor: string;
    originalAmountMinor: string;
    status: 'NEW' | 'UNPAID' | 'PAID' | 'OVERDUE';
    description: string | null;
    articleCode: string | null;
    address: string | null;
    assignmentConfirmedAt: string;
    assignmentSource: 'AUTOMATIC' | 'AUTO_EXACT' | 'MANUAL' | null;
    vehicle: { id: string; label: string; registrationNumber: string | null } | null;
    rental: {
      id: string;
      contractNumber: string | null;
      startsAt: string;
      endsAt: string;
    } | null;
  }>;
};
