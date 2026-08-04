import type { AuditAction, AuditEntityType } from '@/database/generated/prisma';

export interface WriteAuditLogInput {
  actor: { id: string; email: string };
  companyId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  entityLabel?: string;
  changes?: Readonly<Record<string, unknown>>;
}

export interface AuditLogItem {
  id: string;
  actorLabel: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityLabel: string | null;
  companyLabel: string | null;
  createdAt: string;
}
