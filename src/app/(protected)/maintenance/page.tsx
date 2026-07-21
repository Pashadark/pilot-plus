import { requireAdmin } from '@/modules/auth/dal';
import { MaintenancePage } from '@/modules/maintenance/components/MaintenancePage';
import { listMaintenanceForUser } from '@/modules/maintenance/server/queries';
import { listVehicleOptionsForUser } from '@/modules/vehicles/server/queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function MaintenanceRoute() {
  const user = await requireAdmin();
  const [records, vehicles] = await Promise.all([
    listMaintenanceForUser(user.id),
    listVehicleOptionsForUser(user.id),
  ]);

  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Техническое обслуживание' }]}>
      <MaintenancePage records={records} vehicles={vehicles} />
    </AppShell>
  );
}
