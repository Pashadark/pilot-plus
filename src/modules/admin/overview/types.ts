import type { AuditLogItem } from '@/modules/admin/audit';

export interface AdminTeamMember {
  id: string;
  name: string;
  email: string;
  role: 'COMPANY_ADMIN' | 'DISPATCHER' | 'DRIVER' | 'VIEWER';
  isActive: boolean;
}

export interface AdminCompanyProfile {
  id: string;
  name: string;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  directorName: string | null;
  legalAddress: string | null;
  actualAddress: string | null;
  phone: string | null;
  email: string | null;
  isDemo: boolean;
  team: readonly AdminTeamMember[];
}

export interface AdminOverview {
  scope: 'SYSTEM' | 'COMPANY';
  companies: number;
  users: number;
  vehicles: number;
  devices: number;
  recentAudit: readonly AuditLogItem[];
  companyProfiles: readonly AdminCompanyProfile[];
}
