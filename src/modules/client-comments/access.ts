import type { CompanyRole } from '@/database/generated/prisma';

export function canCreateClientComment(role: CompanyRole): boolean {
  return role === 'COMPANY_ADMIN' || role === 'DISPATCHER';
}

export function canHideClientComment(
  role: CompanyRole,
  actorUserId: string,
  authorUserId: string,
): boolean {
  return role === 'COMPANY_ADMIN' || (role === 'DISPATCHER' && actorUserId === authorUserId);
}
