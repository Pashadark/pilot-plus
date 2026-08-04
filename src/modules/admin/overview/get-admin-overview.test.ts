import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminCenterAccess } from '@/modules/admin/access';

const prismaMocks = vi.hoisted(() => ({
  companyCount: vi.fn(),
  companyMemberFindMany: vi.fn(),
  deviceCount: vi.fn(),
  userCount: vi.fn(),
  vehicleCount: vi.fn(),
}));
const getRecentAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('@/database/prisma/client', () => ({
  prisma: {
    company: { count: prismaMocks.companyCount },
    companyMember: { findMany: prismaMocks.companyMemberFindMany },
    device: { count: prismaMocks.deviceCount },
    user: { count: prismaMocks.userCount },
    vehicle: { count: prismaMocks.vehicleCount },
  },
}));
vi.mock('@/modules/admin/audit', () => ({ getRecentAuditLog: getRecentAuditLogMock }));

import { getAdminOverview } from './get-admin-overview';

const user = {
  id: 'user-1',
  email: 'admin@example.com',
  name: 'Павел Седов',
  role: 'SUPER_ADMIN' as const,
  canAccessAdmin: true,
};

const systemAccess: AdminCenterAccess = { user, scope: 'SYSTEM', companyIds: [] };
const companyAccess: AdminCenterAccess = {
  user: { ...user, role: 'MEMBER' },
  scope: 'COMPANY',
  companyIds: ['company-2', 'company-1'],
};

describe('getAdminOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.companyCount.mockResolvedValue(3);
    prismaMocks.companyMemberFindMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
    prismaMocks.deviceCount.mockResolvedValue(11);
    prismaMocks.userCount.mockResolvedValue(7);
    prismaMocks.vehicleCount.mockResolvedValue(19);
    getRecentAuditLogMock.mockResolvedValue([]);
  });

  it('собирает глобальные counts без tenant filters для системного доступа', async () => {
    await expect(getAdminOverview(systemAccess)).resolves.toEqual({
      scope: 'SYSTEM',
      companies: 3,
      users: 7,
      vehicles: 19,
      devices: 11,
      recentAudit: [],
    });

    expect(prismaMocks.companyCount).toHaveBeenCalledExactlyOnceWith();
    expect(prismaMocks.userCount).toHaveBeenCalledExactlyOnceWith();
    expect(prismaMocks.vehicleCount).toHaveBeenCalledExactlyOnceWith();
    expect(prismaMocks.deviceCount).toHaveBeenCalledExactlyOnceWith();
    expect(prismaMocks.companyMemberFindMany).not.toHaveBeenCalled();
    expect(getRecentAuditLogMock).toHaveBeenCalledExactlyOnceWith(systemAccess);
  });

  it('ограничивает tenant counts и считает пользователей через distinct membership ids', async () => {
    await expect(getAdminOverview(companyAccess)).resolves.toEqual({
      scope: 'COMPANY',
      companies: 3,
      users: 2,
      vehicles: 19,
      devices: 11,
      recentAudit: [],
    });

    const tenantFilter = { in: ['company-2', 'company-1'] };
    expect(prismaMocks.companyCount).toHaveBeenCalledExactlyOnceWith({ where: { id: tenantFilter } });
    expect(prismaMocks.vehicleCount).toHaveBeenCalledExactlyOnceWith({
      where: { companyId: tenantFilter },
    });
    expect(prismaMocks.deviceCount).toHaveBeenCalledExactlyOnceWith({
      where: { companyId: tenantFilter },
    });
    expect(prismaMocks.companyMemberFindMany).toHaveBeenCalledExactlyOnceWith({
      where: { companyId: tenantFilter },
      distinct: ['userId'],
      select: { userId: true },
    });
    expect(prismaMocks.userCount).not.toHaveBeenCalled();
    expect(getRecentAuditLogMock).toHaveBeenCalledExactlyOnceWith(companyAccess);
  });
});
