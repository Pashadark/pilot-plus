import type { CompanyRole } from '@/database/generated/prisma';

export type CompanyPermissionValue =
  | 'MANAGE_USERS'
  | 'MANAGE_ROLES'
  | 'MANAGE_VEHICLES'
  | 'MANAGE_DEVICES'
  | 'MANAGE_DOCUMENTS'
  | 'MANAGE_MAINTENANCE'
  | 'MANAGE_WASH'
  | 'VIEW_REPORTS'
  | 'VIEW_AUDIT';

const allCompanyPermissions: readonly CompanyPermissionValue[] = [
  'MANAGE_USERS',
  'MANAGE_ROLES',
  'MANAGE_VEHICLES',
  'MANAGE_DEVICES',
  'MANAGE_DOCUMENTS',
  'MANAGE_MAINTENANCE',
  'MANAGE_WASH',
  'VIEW_REPORTS',
  'VIEW_AUDIT',
];

const permissionsByRole: Record<CompanyRole, readonly CompanyPermissionValue[]> = {
  COMPANY_ADMIN: allCompanyPermissions,
  DISPATCHER: [
    'MANAGE_VEHICLES',
    'MANAGE_DEVICES',
    'MANAGE_MAINTENANCE',
    'MANAGE_WASH',
    'VIEW_REPORTS',
  ],
  DRIVER: [],
  VIEWER: ['VIEW_REPORTS'],
};

export function resolveCompanyPermissions(
  role: CompanyRole,
  additionalPermissions: readonly CompanyPermissionValue[],
): ReadonlySet<CompanyPermissionValue> {
  return new Set([...permissionsByRole[role], ...additionalPermissions]);
}

export function hasCompanyPermission(
  role: CompanyRole,
  additionalPermissions: readonly CompanyPermissionValue[],
  permission: CompanyPermissionValue,
): boolean {
  return resolveCompanyPermissions(role, additionalPermissions).has(permission);
}
