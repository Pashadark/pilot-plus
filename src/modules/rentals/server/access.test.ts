import { beforeEach, describe, expect, it, vi } from 'vitest';

const readSessionMock = vi.hoisted(() => vi.fn());
const membershipFindManyMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/auth/session', () => ({ readSession: readSessionMock }));
vi.mock('@/database/prisma/client', () => ({
  prisma: { companyMember: { findMany: membershipFindManyMock } },
}));
vi.mock('server-only', () => ({}));

import {
  RentalAccessDeniedError,
  canAccessRentalCompany,
  canManageRentals,
  getRentalAccessForUser,
  getRentalAccess,
  requireRentalAccess,
} from './access';

const superAdmin = {
  id: 'user-system',
  email: 'admin@pilot.test',
  name: 'Павел',
  role: 'SUPER_ADMIN' as const,
  canAccessAdmin: true,
};

describe('серверный доступ к договорам аренды', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['COMPANY_ADMIN', true],
    ['DISPATCHER', true],
    ['VIEWER', false],
    ['DRIVER', false],
  ] as const)('роль %s %s работать с договорами', (role, expected) => {
    expect(canManageRentals(role)).toBe(expected);
  });

  it('даёт суперадминистратору доступ к договорам любой компании', async () => {
    readSessionMock.mockResolvedValue(superAdmin);

    const access = await getRentalAccess();

    expect(access).toMatchObject({ scope: 'SYSTEM', companyIds: [] });
    expect(canAccessRentalCompany(access, 'company-foreign')).toBe(true);
    expect(membershipFindManyMock).not.toHaveBeenCalled();
  });

  it('строит доступ для уже проверенного пользователя без повторного чтения сессии', async () => {
    const access = await getRentalAccessForUser(superAdmin);

    expect(access).toMatchObject({ user: superAdmin, scope: 'SYSTEM', companyIds: [] });
    expect(readSessionMock).not.toHaveBeenCalled();
    expect(membershipFindManyMock).not.toHaveBeenCalled();
  });

  it('не раскрывает договоры viewer и driver, даже с additional permission', async () => {
    readSessionMock.mockResolvedValue({
      ...superAdmin,
      id: 'user-grants',
      role: 'MEMBER' as const,
    });
    membershipFindManyMock.mockResolvedValue([
      { companyId: 'company-viewer', role: 'VIEWER', additionalPermissions: ['MANAGE_VEHICLES'] },
      { companyId: 'company-driver', role: 'DRIVER', additionalPermissions: ['MANAGE_VEHICLES'] },
    ]);

    await expect(getRentalAccess()).resolves.toBeNull();
  });

  it('разрешает только exact company membership и отклоняет чужую компанию', async () => {
    readSessionMock.mockResolvedValue({
      ...superAdmin,
      id: 'user-dispatcher',
      role: 'MEMBER' as const,
    });
    membershipFindManyMock.mockResolvedValue([
      { companyId: 'company-a', role: 'DISPATCHER', additionalPermissions: [] },
      { companyId: 'company-b', role: 'VIEWER', additionalPermissions: [] },
    ]);

    await expect(requireRentalAccess('company-a')).resolves.toMatchObject({
      scope: 'COMPANY',
      companyIds: ['company-a'],
    });
    await expect(requireRentalAccess('company-b')).rejects.toThrow(RentalAccessDeniedError);
    await expect(requireRentalAccess('company-b')).rejects.toThrow(
      'Доступ к договорам аренды запрещён.',
    );
  });

  it('отклоняет запрос без активной сессии', async () => {
    readSessionMock.mockResolvedValue(null);

    await expect(getRentalAccess()).resolves.toBeNull();
    await expect(requireRentalAccess('company-a')).rejects.toThrow(
      'Доступ к договорам аренды запрещён.',
    );
  });
});
