import type { AuditLogItem } from '@/modules/admin/audit';

export interface AdminOverview {
  scope: 'SYSTEM' | 'COMPANY';
  companies: number;
  users: number;
  vehicles: number;
  devices: number;
  recentAudit: readonly AuditLogItem[];
}
