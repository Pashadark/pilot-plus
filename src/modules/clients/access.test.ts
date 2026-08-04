import { beforeEach, describe, expect, it, vi } from 'vitest';

const readSessionMock = vi.hoisted(() => vi.fn());
const membershipFindManyMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/auth/session', () => ({ readSession: readSessionMock }));
vi.mock('@/database/prisma/client', () => ({
  prisma: { companyMember: { findMany: membershipFindManyMock } },
}));

import { getClientAccess, requireClientAccess } from './access';

const superAdmin = {
  id: 'user-system',
  email: 'admin@pilot.test',
  name: 'Павел',
  role: 'SUPER_ADMIN' as const,
  canAccessAdmin: true,
};

describe('серверный доступ к клиентам компании', () => {
  beforeEach(() => vi.clearAllMocks());

  it('выдаёт суперадминистратору системную область', async () => {
    readSessionMock.mockResolvedValue(superAdmin);

    await expect(getClientAccess('VIEW_CLIENTS')).resolves.toMatchObject({
      scope: 'SYSTEM',
      companyIds: [],
      canManage: true,
    });
    expect(membershipFindManyMock).not.toHaveBeenCalled();
  });

  it('выдаёт управляющему клиентами участнику только разрешённые компании', async () => {
    const dispatcher = { ...superAdmin, id: 'user-company', role: 'MEMBER' as const };
    readSessionMock.mockResolvedValue(dispatcher);
    membershipFindManyMock.mockResolvedValue([
      {
        companyId: 'c1',
        role: 'DISPATCHER',
        additionalPermissions: [],
      },
      {
        companyId: 'c2',
        role: 'VIEWER',
        additionalPermissions: [],
      },
    ]);

    await expect(getClientAccess('MANAGE_CLIENTS')).resolves.toMatchObject({
      scope: 'COMPANY',
      companyIds: ['c1'],
      canManage: true,
    });
    expect(membershipFindManyMock).toHaveBeenCalledWith({
      where: { userId: 'user-company' },
      select: { companyId: true, role: true, additionalPermissions: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('учитывает индивидуальный grant при выборе компаний', async () => {
    readSessionMock.mockResolvedValue({ ...superAdmin, id: 'user-grant', role: 'MEMBER' as const });
    membershipFindManyMock.mockResolvedValue([
      {
        companyId: 'c1',
        role: 'DRIVER',
        additionalPermissions: ['VIEW_CLIENTS'],
      },
    ]);

    await expect(getClientAccess('VIEW_CLIENTS')).resolves.toMatchObject({
      scope: 'COMPANY',
      companyIds: ['c1'],
      canManage: false,
    });
  });

  it('не выдаёт доступ водителю без клиентских разрешений', async () => {
    readSessionMock.mockResolvedValue({ ...superAdmin, role: 'MEMBER' as const });
    membershipFindManyMock.mockResolvedValue([
      {
        companyId: 'c1',
        role: 'DRIVER',
        additionalPermissions: [],
      },
    ]);

    await expect(getClientAccess('VIEW_CLIENTS')).resolves.toBeNull();
    await expect(requireClientAccess('VIEW_CLIENTS')).rejects.toThrow(
      'Доступ к клиентам запрещён.',
    );
  });
});
