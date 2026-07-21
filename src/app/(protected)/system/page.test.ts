import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSystemHealth: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock('@/modules/auth/dal', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/modules/system-health/get-system-health', () => ({
  getSystemHealth: mocks.getSystemHealth,
}));

import SystemPage from './page';

describe('SystemPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('проверяет администратора до запуска health probes', async () => {
    mocks.requireAdmin.mockResolvedValue({ id: 'admin' });
    mocks.getSystemHealth.mockResolvedValue([]);

    await SystemPage();

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.getSystemHealth).toHaveBeenCalledOnce();
    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getSystemHealth.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it('не запускает health probes при ошибке или redirect проверки сессии', async () => {
    const sessionFailure = new Error('NEXT_REDIRECT');
    mocks.requireAdmin.mockRejectedValue(sessionFailure);

    await expect(SystemPage()).rejects.toBe(sessionFailure);

    expect(mocks.getSystemHealth).not.toHaveBeenCalled();
  });
});
