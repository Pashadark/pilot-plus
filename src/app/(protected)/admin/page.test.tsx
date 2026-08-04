import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  AdminOverviewPage: ({ overview }: { overview: { scope: string } }) => <div>{overview.scope}</div>,
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
  ForbiddenState: () => <div data-testid="forbidden-state" />,
  getAdminCenterAccess: vi.fn(),
  getAdminOverview: vi.fn(),
}));

vi.mock('@/modules/admin/access', () => ({ getAdminCenterAccess: mocks.getAdminCenterAccess }));
vi.mock('@/modules/admin/overview', () => ({
  AdminOverviewPage: mocks.AdminOverviewPage,
  getAdminOverview: mocks.getAdminOverview,
}));
vi.mock('@/shared/components/app-shell/AppShell', () => ({ AppShell: mocks.AppShell }));
vi.mock('@/shared/ui', () => ({ ForbiddenState: mocks.ForbiddenState }));

import AdminPage from './page';

const access = {
  user: {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Павел',
    role: 'SUPER_ADMIN' as const,
    canAccessAdmin: true,
  },
  scope: 'SYSTEM' as const,
  companyIds: [],
};

describe('AdminPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('проверяет доступ до запроса обзора', async () => {
    mocks.getAdminCenterAccess.mockResolvedValue(access);
    mocks.getAdminOverview.mockResolvedValue({ scope: 'SYSTEM' });

    await AdminPage();

    expect(mocks.getAdminCenterAccess).toHaveBeenCalledOnce();
    expect(mocks.getAdminOverview).toHaveBeenCalledExactlyOnceWith(access);
    expect(mocks.getAdminCenterAccess.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getAdminOverview.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it('показывает ForbiddenState внутри AppShell и не запрашивает данные без доступа', async () => {
    mocks.getAdminCenterAccess.mockResolvedValue(null);

    const page = await AdminPage();

    expect(mocks.getAdminOverview).not.toHaveBeenCalled();
    expect(page.type).toBe(mocks.AppShell);
    expect(page.props.children.type).toBe(mocks.ForbiddenState);
  });
});
