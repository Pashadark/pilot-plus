import { requireAdmin } from '@/modules/auth/dal';
import { VehicleListPage } from '@/modules/vehicles/components/VehicleListPage';
import { listVehiclesForUser } from '@/modules/vehicles/server/queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function VehiclesPage() {
  const user = await requireAdmin();
  const vehicles = await listVehiclesForUser(user.id);

  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Автомобили' }]}>
      <VehicleListPage vehicles={vehicles} />
    </AppShell>
  );
}
