import { Dashboard } from '@/modules/dashboard/Dashboard';
import {
  fleetEvents,
  fleetStats,
  fuelBreakdown,
  mileageByDay,
  vehicles,
} from '@/modules/dashboard/fixtures';
import { AppShell } from '@/shared/components/app-shell/AppShell';
import { FlashToast, type FlashToastKind } from '@/shared/providers/ToastProvider';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const query = await searchParams;
  const flash: FlashToastKind | null = query.welcome === '1' ? 'welcome' : null;

  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Панель управления' }]}>
      <FlashToast kind={flash} />
      <Dashboard
        stats={fleetStats}
        events={fleetEvents}
        vehicles={vehicles}
        mileage={mileageByDay}
        fuel={fuelBreakdown}
      />
    </AppShell>
  );
}
