import { beforeEach, describe, expect, it, vi } from 'vitest';

const readSessionMock = vi.hoisted(() => vi.fn());
const membershipFindManyMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/auth/session', () => ({ readSession: readSessionMock }));
vi.mock('@/database/prisma/client', () => ({
  prisma: { companyMember: { findMany: membershipFindManyMock } },
}));
vi.mock('server-only', () => ({}));

import {
  FineAccessDeniedError,
  canConfigureFineIntegration,
  getFineAccess,
  requireFineManageAccess,
} from './access';

const member = {
  id: 'user-member',
  email: 'member@pilot.test',
  name: 'Менеджер',
  role: 'MEMBER' as const,
  canAccessAdmin: false,
};

describe('доступ к штрафам', () => {
  beforeEach(() => vi.clearAllMocks());

  it('разрешает администратору и диспетчеру только свои компании', async () => {
    readSessionMock.mockResolvedValue(member);
    membershipFindManyMock.mockResolvedValue([
      { companyId: 'company-a', role: 'COMPANY_ADMIN', additionalPermissions: [] },
      { companyId: 'company-b', role: 'DISPATCHER', additionalPermissions: [] },
      { companyId: 'company-c', role: 'VIEWER', additionalPermissions: [] },
    ]);

    await expect(getFineAccess()).resolves.toMatchObject({
      scope: 'COMPANY',
      companyIds: ['company-a', 'company-b'],
    });
    await expect(requireFineManageAccess('company-b')).resolves.toBeDefined();
    await expect(requireFineManageAccess('company-c')).rejects.toThrow(FineAccessDeniedError);
  });

  it('не разрешает driver/viewer даже с дополнительными правами', async () => {
    readSessionMock.mockResolvedValue(member);
    membershipFindManyMock.mockResolvedValue([
      { companyId: 'company-a', role: 'DRIVER', additionalPermissions: ['MANAGE_FINES'] },
      { companyId: 'company-b', role: 'VIEWER', additionalPermissions: ['VIEW_FINES'] },
    ]);

    await expect(getFineAccess()).resolves.toBeNull();
  });

  it('разрешает настройку токена только superadmin и company admin', () => {
    expect(canConfigureFineIntegration('SUPER_ADMIN')).toBe(true);
    expect(canConfigureFineIntegration('COMPANY_ADMIN')).toBe(true);
    expect(canConfigureFineIntegration('DISPATCHER')).toBe(false);
  });
});
