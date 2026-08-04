import { describe, expect, it } from 'vitest';

import { hasCompanyPermission, resolveCompanyPermissions } from './permissions';

describe('политика прав компании', () => {
  it('выдаёт администратору компании полный набор прав', () => {
    expect(resolveCompanyPermissions('COMPANY_ADMIN', [])).toEqual(
      new Set([
        'MANAGE_USERS',
        'MANAGE_ROLES',
        'VIEW_CLIENTS',
        'MANAGE_CLIENTS',
        'MANAGE_VEHICLES',
        'MANAGE_DEVICES',
        'MANAGE_DOCUMENTS',
        'MANAGE_MAINTENANCE',
        'MANAGE_WASH',
        'VIEW_REPORTS',
        'VIEW_AUDIT',
      ]),
    );
  });

  it.each([
    [
      'DISPATCHER',
      ['MANAGE_CLIENTS', 'MANAGE_MAINTENANCE', 'MANAGE_WASH', 'VIEW_CLIENTS', 'VIEW_REPORTS'],
    ],
    ['DRIVER', []],
    ['VIEWER', ['VIEW_CLIENTS', 'VIEW_REPORTS']],
  ] as const)('выдаёт роли %s только безопасный базовый набор', (role, expected) => {
    expect(resolveCompanyPermissions(role, [])).toEqual(new Set(expected));
  });

  it('добавляет индивидуальное право без изменения базовой матрицы', () => {
    expect(hasCompanyPermission('VIEWER', [], 'MANAGE_VEHICLES')).toBe(false);
    expect(hasCompanyPermission('VIEWER', ['MANAGE_VEHICLES'], 'MANAGE_VEHICLES')).toBe(true);
  });

  it('выдаёт диспетчеру управление транспортом и устройствами только отдельными grants', () => {
    expect(hasCompanyPermission('DISPATCHER', [], 'MANAGE_VEHICLES')).toBe(false);
    expect(hasCompanyPermission('DISPATCHER', [], 'MANAGE_DEVICES')).toBe(false);
    expect(hasCompanyPermission('DISPATCHER', ['MANAGE_VEHICLES'], 'MANAGE_VEHICLES')).toBe(true);
  });

  it('не моделирует системного суперадминистратора через права компании', () => {
    expect(resolveCompanyPermissions('VIEWER', ['VIEW_AUDIT'])).toEqual(
      new Set(['VIEW_CLIENTS', 'VIEW_REPORTS', 'VIEW_AUDIT']),
    );
    expect([...resolveCompanyPermissions('DRIVER', [])]).not.toContain('SUPER_ADMIN');
  });

  it('выдаёт клиентские права только согласно ролевой матрице', () => {
    expect(hasCompanyPermission('DISPATCHER', [], 'MANAGE_CLIENTS')).toBe(true);
    expect(hasCompanyPermission('VIEWER', [], 'VIEW_CLIENTS')).toBe(true);
    expect(hasCompanyPermission('DRIVER', [], 'VIEW_CLIENTS')).toBe(false);
  });
});
