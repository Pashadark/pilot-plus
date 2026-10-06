import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOperationalHealth: vi.fn(),
  getSystemHealth: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock('@/modules/auth/dal', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('@/modules/system-health/get-system-health', () => ({
  getSystemHealth: mocks.getSystemHealth,
}));
vi.mock('@/modules/system-health/get-operational-health', () => ({
  getOperationalHealth: mocks.getOperationalHealth,
}));

import SystemPage from './page';

describe('SystemPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('проверяет администратора до запуска health probes', async () => {
    mocks.requireAdmin.mockResolvedValue({ id: 'admin', role: 'SUPER_ADMIN' });
    mocks.getSystemHealth.mockResolvedValue([]);
    mocks.getOperationalHealth.mockResolvedValue([]);

    await SystemPage();

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.getSystemHealth).not.toHaveBeenCalled();
  });

  it('не запускает health probes при ошибке или redirect проверки сессии', async () => {
    const sessionFailure = new Error('NEXT_REDIRECT');
    mocks.requireAdmin.mockRejectedValue(sessionFailure);

    await expect(SystemPage()).rejects.toBe(sessionFailure);

    expect(mocks.getSystemHealth).not.toHaveBeenCalled();
    expect(mocks.getOperationalHealth).not.toHaveBeenCalled();
  });
  it('запрещает доступ администратору компании', async () => {
    mocks.requireAdmin.mockResolvedValue({ role: 'MEMBER', canAccessAdmin: true });
    await expect(SystemPage()).rejects.toThrow('NOT_FOUND');
  });
});
