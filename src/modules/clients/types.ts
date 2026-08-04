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
