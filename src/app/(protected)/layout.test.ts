import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCachedSystemHealthSummary: vi.fn(),
  getClientAccess: vi.fn(),
  getRentalAccessForUser: vi.fn(),
  getFineAccessForUser: vi.fn(),
  listNotificationsForCurrentUser: vi.fn(),
  getUrgentDepositSidebarCount: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock('@/modules/auth/dal', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/modules/system-health/get-system-health-summary', () => ({
  getCachedSystemHealthSummary: mocks.getCachedSystemHealthSummary,
}));
vi.mock('@/modules/clients/access', () => ({ getClientAccess: mocks.getClientAccess }));
vi.mock('@/modules/rentals/server/access', () => ({
  getRentalAccessForUser: mocks.getRentalAccessForUser,
}));
vi.mock('@/modules/fines/access', () => ({ getFineAccessForUser: mocks.getFineAccessForUser }));
vi.mock('@/modules/fines/server/sidebar-count', () => ({
  getOpenFineSidebarCount: vi.fn().mockResolvedValue(0),
}));
vi.mock('@/modules/leads/sidebar-count', () => ({
  getOpenLeadSidebarCount: vi.fn().mockResolvedValue(0),
}));
vi.mock('@/modules/deposits/server/sidebar-count', () => ({
  getUrgentDepositSidebarCount: mocks.getUrgentDepositSidebarCount,
}));
vi.mock('@/modules/notifications/server/queries', () => ({
  getNotificationPage: mocks.listNotificationsForCurrentUser,
}));

import ProtectedLayout from './layout';

describe('ProtectedLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUrgentDepositSidebarCount.mockResolvedValue(7);
  });

  it('получает cached health summary только после проверки администратора', async () => {
    mocks.requireAdmin.mockResolvedValue({
      id: 'admin-1',
      name: 'Администратор',
      email: 'admin@pilot.local',
      role: 'SUPER_ADMIN',
      canAccessAdmin: true,
    });
    mocks.getClientAccess.mockResolvedValue({ scope: 'SYSTEM' });
    mocks.getRentalAccessForUser.mockResolvedValue({ scope: 'SYSTEM' });
    mocks.getFineAccessForUser.mockResolvedValue({ scope: 'SYSTEM' });
    mocks.listNotificationsForCurrentUser.mockResolvedValue({
      items: [],
      unreadCount: 0,
      nextCursor: null,
    });
    mocks.getCachedSystemHealthSummary.mockResolvedValue({
      state: 'healthy',
      count: 3,
      total: 4,
      checkedAt: '2026-07-20T12:00:00.000Z',
    });

    const result = await ProtectedLayout({ children: 'content' });

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.getCachedSystemHealthSummary).toHaveBeenCalledOnce();
    expect(mocks.getRentalAccessForUser).toHaveBeenCalledWith({
      id: 'admin-1',
      name: 'Администратор',
      email: 'admin@pilot.local',
      role: 'SUPER_ADMIN',
      canAccessAdmin: true,
    });
    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getCachedSystemHealthSummary.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(result.props.children.props).toMatchObject({
      systemHealthSummary: {
        state: 'healthy',
        count: 3,
        total: 4,
        checkedAt: '2026-07-20T12:00:00.000Z',
      },
      user: expect.objectContaining({
        canAccessAdmin: true,
        capabilities: ['CLIENTS', 'RENTALS', 'FINES'],
      }),
      openDepositCount: 7,
    });
  });

  it('не вычисляет health summary при ошибке проверки сессии', async () => {
    const sessionFailure = new Error('NEXT_REDIRECT');
    mocks.requireAdmin.mockRejectedValue(sessionFailure);

    await expect(ProtectedLayout({ children: 'content' })).rejects.toBe(sessionFailure);

    expect(mocks.getCachedSystemHealthSummary).not.toHaveBeenCalled();
  });
});
