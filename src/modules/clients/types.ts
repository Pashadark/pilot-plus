import type { ClientStatus as PrismaClientStatus } from '@/database/generated/prisma';

export type ClientStatus = PrismaClientStatus;

export type ClientInput = {
  companyId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthDate: Date | null;
  phone: string;
  email: string | null;
  passport: string | null;
  driverLicense: string | null;
  driverLicenseIssuedAt: Date | null;
  driverLicenseExpiresAt: Date | null;
  status: ClientStatus;
};

export type ClientInputResult =
  { ok: true; data: ClientInput } | { ok: false; fieldErrors: Record<string, string> };

export type ClientCardDto = {
  id: string;
  companyId: string;
  fullName: string;
  email: string | null;
  phoneMasked: string;
  passportMasked: string | null;
  driverLicenseMasked: string | null;
  driverLicenseExpiresAt: string | null;
  status: ClientStatus;
  updatedAt: string;
  localPhotoUrl: string | null;
  telegramUrl: string | null;
};

export type ClientDetailDto = ClientCardDto & {
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthDate: string | null;
  phone: string;
  passport: string | null;
  driverLicense: string | null;
  driverLicenseIssuedAt: string | null;
  createdAt: string;
};

export type ClientQueryFilters = {
  q?: string;
  status?: ClientStatus;
  documents?: 'present' | 'missing';
  license?: 'present' | 'missing';
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
