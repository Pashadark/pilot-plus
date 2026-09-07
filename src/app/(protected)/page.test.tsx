import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  CommandCenterDashboard: ({ overview }: { overview: { period: { key: string } } }) => (
    <div data-testid="command-center">{overview.period.key}</div>
  ),
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  FlashToast: () => null,
  getDashboardOverviewForCurrentUser: vi.fn(),
}));

vi.mock('@/modules/dashboard/CommandCenterDashboard', () => ({
  CommandCenterDashboard: mocks.CommandCenterDashboard,
}));
vi.mock('@/modules/dashboard/server/queries', () => ({
  getDashboardOverviewForCurrentUser: mocks.getDashboardOverviewForCurrentUser,
}));
vi.mock('@/shared/components/app-shell/AppShell', () => ({ AppShell: mocks.AppShell }));
vi.mock('@/shared/providers/ToastProvider', () => ({ FlashToast: mocks.FlashToast }));

import Home from './page';

describe('Home command center', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads real dashboard data for the selected period', async () => {
    const overview = { period: { key: 'tomorrow' } };
    mocks.getDashboardOverviewForCurrentUser.mockResolvedValue(overview);

    const page = await Home({ searchParams: Promise.resolve({ period: 'tomorrow' }) });

    expect(mocks.getDashboardOverviewForCurrentUser).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'tomorrow', label: 'Завтра' }),
    );
    expect(page.props.children[1].type).toBe(mocks.CommandCenterDashboard);
    expect(page.props.children[1].props.overview).toBe(overview);
  });
});
