import { AppShell } from '@/shared/components/app-shell/AppShell';
import { StatisticsPage } from '@/modules/statistics/StatisticsPage';
import { getStatisticsWorkspace } from '@/modules/statistics/server/queries';

export default async function StatisticsRoute({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string | string[]; period?: string | string[] }>;
}) {
  const filters = await searchParams;
  const workspace = await getStatisticsWorkspace({
    vehicleId: typeof filters.vehicleId === 'string' ? filters.vehicleId : undefined,
    period: typeof filters.period === 'string' ? filters.period : undefined,
  });
  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Статистика' }]}>
      <StatisticsPage workspace={workspace} />
    </AppShell>
  );
}
