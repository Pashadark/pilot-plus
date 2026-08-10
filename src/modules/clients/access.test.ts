import { beforeEach, describe, expect, it, vi } from 'vitest';

const readSessionMock = vi.hoisted(() => vi.fn());
const membershipFindManyMock = vi.hoisted(() => vi.fn());
const membershipFindFirstMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/auth/session', () => ({ readSession: readSessionMock }));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    companyMember: { findMany: membershipFindManyMock, findFirst: membershipFindFirstMock },
  },
}));

import { canArchiveClient, canManageClient, getClientAccess, requireClientAccess } from './access';

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
      select: { companyId: true, role: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('не позволяет индивидуальным grant открыть клиентские данные водителю', async () => {
    readSessionMock.mockResolvedValue({ ...superAdmin, id: 'user-grant', role: 'MEMBER' as const });
    membershipFindManyMock.mockResolvedValue([
      {
        companyId: 'c1',
        role: 'DRIVER',
        additionalPermissions: ['VIEW_CLIENTS'],
      },
    ]);

    await expect(getClientAccess('VIEW_CLIENTS')).resolves.toBeNull();
  });

  it('не позволяет индивидуальным grant дать viewer управление клиентами', async () => {
    readSessionMock.mockResolvedValue({
      ...superAdmin,
      id: 'user-viewer',
      role: 'MEMBER' as const,
    });
    membershipFindManyMock.mockResolvedValue([
      {
        companyId: 'c1',
        role: 'VIEWER',
        additionalPermissions: ['MANAGE_CLIENTS'],
      },
    ]);

    await expect(getClientAccess('MANAGE_CLIENTS')).resolves.toBeNull();
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

  it('не даёт редактировать карточку viewer-компании при manage доступе к другой компании', async () => {
    const dispatcher = { ...superAdmin, id: 'user-mixed', role: 'MEMBER' as const };
    readSessionMock.mockResolvedValue(dispatcher);
    membershipFindManyMock.mockResolvedValue([
      { companyId: 'company-a', role: 'DISPATCHER', additionalPermissions: [] },
      { companyId: 'company-b', role: 'VIEWER', additionalPermissions: [] },
    ]);

    const access = await getClientAccess('MANAGE_CLIENTS');
    expect(access).not.toBeNull();
    expect(canManageClient(access!, 'company-a')).toBe(true);
    expect(canManageClient(access!, 'company-b')).toBe(false);
  });

  it('показывает архивирование только администратору своей компании', async () => {
    const access = {
      user: { ...superAdmin, id: 'company-user', role: 'MEMBER' as const },
      scope: 'COMPANY' as const,
      companyIds: ['company-a'],
      canManage: true,
    };
    membershipFindFirstMock.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'member-1' });

    await expect(canArchiveClient(access, 'company-a')).resolves.toBe(false);
    await expect(canArchiveClient(access, 'company-a')).resolves.toBe(true);
    await expect(canArchiveClient(access, 'company-b')).resolves.toBe(false);
  });

  it('разрешает архивирование суперадминистратору без membership-запроса', async () => {
    await expect(
      canArchiveClient(
        { user: superAdmin, scope: 'SYSTEM', companyIds: [], canManage: true },
        'company-a',
      ),
    ).resolves.toBe(true);
    expect(membershipFindFirstMock).not.toHaveBeenCalled();
  });
});
