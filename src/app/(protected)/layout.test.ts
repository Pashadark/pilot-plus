import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCachedSystemHealthSummary: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock('@/modules/auth/dal', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/modules/system-health/get-system-health-summary', () => ({
  getCachedSystemHealthSummary: mocks.getCachedSystemHealthSummary,
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
      role: 'ADMIN',
    });
    mocks.getCachedSystemHealthSummary.mockResolvedValue({
      state: 'healthy',
      count: 3,
      checkedAt: '2026-07-20T12:00:00.000Z',
    });

    const result = await ProtectedLayout({ children: 'content' });

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.getCachedSystemHealthSummary).toHaveBeenCalledOnce();
    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getCachedSystemHealthSummary.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(result.props).toMatchObject({
      systemHealthSummary: {
        state: 'healthy',
        count: 3,
        checkedAt: '2026-07-20T12:00:00.000Z',
      },
    });
  });

  it('не вычисляет health summary при ошибке проверки сессии', async () => {
    const sessionFailure = new Error('NEXT_REDIRECT');
    mocks.requireAdmin.mockRejectedValue(sessionFailure);

    await expect(ProtectedLayout({ children: 'content' })).rejects.toBe(sessionFailure);

    expect(mocks.getCachedSystemHealthSummary).not.toHaveBeenCalled();
  });
});
