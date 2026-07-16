import { Dashboard } from '@/modules/dashboard/Dashboard';
import { fleetEvents, fleetStats, vehicles } from '@/modules/dashboard/fixtures';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default function Home() {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+' }, { label: 'Панель управления' }]}>
      <Dashboard stats={fleetStats} events={fleetEvents} vehicles={vehicles} />
    </AppShell>
  );
}
