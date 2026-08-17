import type { CompanyRole } from '@/database/generated/prisma';
import type { SafeUser } from '@/modules/auth/types';

export interface FineAccess {
  user: SafeUser;
  scope: 'SYSTEM' | 'COMPANY';
  companyIds: readonly string[];
  rolesByCompany: Readonly<Record<string, CompanyRole>>;
}
