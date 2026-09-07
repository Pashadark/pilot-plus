import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCachedSystemHealthSummary: vi.fn(),
  getClientAccess: vi.fn(),
  getRentalAccessForUser: vi.fn(),
  getFineAccessForUser: vi.fn(),
  listNotificationsForCurrentUser: vi.fn(),
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
vi.mock('@/modules/notifications/server/queries', () => ({
  listNotificationsForCurrentUser: mocks.listNotificationsForCurrentUser,
}));

import ProtectedLayout from './layout';

describe('ProtectedLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mocks.listNotificationsForCurrentUser.mockResolvedValue([]);
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
    expect(result.props).toMatchObject({
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
    });
  });

  it('не вычисляет health summary при ошибке проверки сессии', async () => {
    const sessionFailure = new Error('NEXT_REDIRECT');
    mocks.requireAdmin.mockRejectedValue(sessionFailure);

    await expect(ProtectedLayout({ children: 'content' })).rejects.toBe(sessionFailure);

    expect(mocks.getCachedSystemHealthSummary).not.toHaveBeenCalled();
  });
});
