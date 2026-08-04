import { beforeEach, describe, expect, it, vi } from 'vitest';

const readSessionMock = vi.hoisted(() => vi.fn());
const membershipFindManyMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/auth/session', () => ({ readSession: readSessionMock }));
vi.mock('@/database/prisma/client', () => ({
  prisma: { companyMember: { findMany: membershipFindManyMock } },
}));

import {
  AdminAccessDeniedError,
  getAdminCenterAccess,
  requireAdminCenterAccess,
} from './server';

const superAdmin = {
  id: 'user-system',
  email: 'admin@pilot.test',
  name: 'Павел',
  role: 'SUPER_ADMIN' as const,
  canAccessAdmin: true,
};

describe('серверный доступ к центру администрирования', () => {
  beforeEach(() => vi.clearAllMocks());

  it('выдаёт суперадминистратору системную область без tenant ids', async () => {
    readSessionMock.mockResolvedValue(superAdmin);

    await expect(requireAdminCenterAccess()).resolves.toEqual({
      user: superAdmin,
      scope: 'SYSTEM',
      companyIds: [],
    });
    expect(membershipFindManyMock).not.toHaveBeenCalled();
  });

  it('выдаёт администратору компании только его компании', async () => {
    const companyAdmin = { ...superAdmin, id: 'user-company', role: 'MEMBER' as const };
    readSessionMock.mockResolvedValue(companyAdmin);
    membershipFindManyMock.mockResolvedValue([{ companyId: 'company-2' }, { companyId: 'company-1' }]);

    await expect(getAdminCenterAccess()).resolves.toEqual({
      user: companyAdmin,
      scope: 'COMPANY',
      companyIds: ['company-2', 'company-1'],
    });
    expect(membershipFindManyMock).toHaveBeenCalledWith({
      where: { userId: 'user-company', role: 'COMPANY_ADMIN' },
      select: { companyId: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('не раскрывает данные обычному участнику', async () => {
    readSessionMock.mockResolvedValue({ ...superAdmin, role: 'MEMBER', canAccessAdmin: false });
    membershipFindManyMock.mockResolvedValue([]);

    await expect(getAdminCenterAccess()).resolves.toBeNull();
    await expect(requireAdminCenterAccess()).rejects.toBeInstanceOf(AdminAccessDeniedError);
  });

  it('закрывает доступ без активной сессии', async () => {
    readSessionMock.mockResolvedValue(null);

    await expect(getAdminCenterAccess()).resolves.toBeNull();
    expect(membershipFindManyMock).not.toHaveBeenCalled();
  });
});
