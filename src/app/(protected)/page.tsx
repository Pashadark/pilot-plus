import { WorkdayDashboard } from '@/modules/dashboard/WorkdayDashboard';
import { parseDashboardSelection } from '@/modules/dashboard/date-window';
import { getDashboardOverviewForCurrentUser } from '@/modules/dashboard/server/queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';
import { FlashToast, type FlashToastKind } from '@/shared/providers/ToastProvider';
import { getMoscowWeather } from '@/modules/weather/server/get-moscow-weather';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; period?: string; from?: string; to?: string }>;
}) {
  const query = await searchParams;
  const flash: FlashToastKind | null = query.welcome === '1' ? 'welcome' : null;
  const period = parseDashboardSelection(query);
  const [overview, weather] = await Promise.all([
    getDashboardOverviewForCurrentUser(period),
    getMoscowWeather(),
  ]);

  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Командный центр' }]}>
      <FlashToast kind={flash} />
      <WorkdayDashboard overview={overview} weather={weather} />
    </AppShell>
  );
}
