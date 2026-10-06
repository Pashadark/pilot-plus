import { describe, expect, it } from 'vitest';

import { buildProfileRole } from './profile-model';

describe('buildProfileRole', () => {
  it('describes the system owner with full permissions', () => {
    expect(buildProfileRole('SUPER_ADMIN', null)).toEqual({
      label: 'Суперадминистратор',
      position: 'Основатель и владелец',
      permissions: [
        'Полный доступ',
        'Управление сотрудниками',
        'Финансы и отчёты',
        'Настройки системы',
      ],
    });
  });

  it.each([
    ['COMPANY_ADMIN', 'Администратор компании'],
    ['DISPATCHER', 'Оператор'],
    ['DRIVER', 'Водитель'],
    ['VIEWER', 'Наблюдатель'],
  ] as const)('uses the company role %s', (companyRole, label) => {
    expect(buildProfileRole('MEMBER', companyRole).label).toBe(label);
  });
});
