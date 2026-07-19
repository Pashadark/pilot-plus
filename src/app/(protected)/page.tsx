import { Dashboard } from '@/modules/dashboard/Dashboard';
import {
  fleetEvents,
  fleetStats,
  fuelBreakdown,
  mileageByDay,
  vehicles,
} from '@/modules/dashboard/fixtures';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default function Home() {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Панель управления' }]}>
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
