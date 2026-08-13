import { beforeEach, describe, expect, it, vi } from 'vitest';

const readSessionMock = vi.hoisted(() => vi.fn());
const membershipFindManyMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/auth/session', () => ({ readSession: readSessionMock }));
vi.mock('@/database/prisma/client', () => ({
  prisma: { companyMember: { findMany: membershipFindManyMock } },
}));
vi.mock('server-only', () => ({}));

import {
  VehicleManagementAccessDeniedError,
  canManageVehicles,
  canManageVehicleCompany,
  getVehicleManagementAccess,
  requireVehicleManagementAccess,
} from './access';

const superAdmin = {
  id: 'user-system',
  email: 'admin@pilot.test',
  name: 'Павел',
  role: 'SUPER_ADMIN' as const,
  canAccessAdmin: true,
};

describe('серверный доступ к управлению автопарком', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['COMPANY_ADMIN', true],
    ['DISPATCHER', true],
    ['VIEWER', false],
    ['DRIVER', false],
  ] as const)('роль %s %s управлять автопарком', (role, expected) => {
    expect(canManageVehicles(role)).toBe(expected);
  });

  it('выдаёт суперадминистратору системную область для любой компании', async () => {
    readSessionMock.mockResolvedValue(superAdmin);

    const access = await getVehicleManagementAccess();

    expect(access).toMatchObject({ scope: 'SYSTEM', companyIds: [] });
    expect(canManageVehicleCompany(access, 'company-foreign')).toBe(true);
    expect(membershipFindManyMock).not.toHaveBeenCalled();
  });

  it('выдаёт company scope только управляющим memberships', async () => {
    readSessionMock.mockResolvedValue({
      ...superAdmin,
      id: 'user-company',
      role: 'MEMBER' as const,
    });
    membershipFindManyMock.mockResolvedValue([
      { companyId: 'company-a', role: 'DISPATCHER', additionalPermissions: [] },
      { companyId: 'company-b', role: 'VIEWER', additionalPermissions: [] },
    ]);

    await expect(getVehicleManagementAccess()).resolves.toMatchObject({
      scope: 'COMPANY',
      companyIds: ['company-a'],
    });
  });

  it('проверяет переданную компанию на сервере', async () => {
    readSessionMock.mockResolvedValue({
      ...superAdmin,
      id: 'user-company',
      role: 'MEMBER' as const,
    });
    membershipFindManyMock.mockResolvedValue([
      { companyId: 'company-a', role: 'COMPANY_ADMIN', additionalPermissions: [] },
    ]);

    await expect(requireVehicleManagementAccess('company-a')).resolves.toMatchObject({
      scope: 'COMPANY',
      companyIds: ['company-a'],
    });
    await expect(requireVehicleManagementAccess('company-foreign')).rejects.toThrow(
      VehicleManagementAccessDeniedError,
    );
    await expect(requireVehicleManagementAccess('company-foreign')).rejects.toThrow(
      'Управление автопарком недоступно.',
    );
  });

  it('не даёт DRIVER или VIEWER обойти матрицу дополнительными permissions', async () => {
    readSessionMock.mockResolvedValue({
      ...superAdmin,
      id: 'user-grants',
      role: 'MEMBER' as const,
    });
    membershipFindManyMock.mockResolvedValue([
      { companyId: 'company-driver', role: 'DRIVER', additionalPermissions: ['MANAGE_VEHICLES'] },
      { companyId: 'company-viewer', role: 'VIEWER', additionalPermissions: ['MANAGE_VEHICLES'] },
    ]);

    await expect(getVehicleManagementAccess()).resolves.toBeNull();
  });

  it('отклоняет неактивную или отсутствующую сессию', async () => {
    readSessionMock.mockResolvedValue(null);

    await expect(getVehicleManagementAccess()).resolves.toBeNull();
    await expect(requireVehicleManagementAccess('company-a')).rejects.toThrow(
      'Управление автопарком недоступно.',
    );
  });
});
