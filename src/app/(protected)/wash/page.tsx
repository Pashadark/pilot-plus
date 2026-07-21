import { requireAdmin } from '@/modules/auth/dal';
import { listVehicleOptionsForUser } from '@/modules/vehicles/server/queries';
import { WashPage } from '@/modules/wash/components/WashPage';
import { listWashRecordsForUser } from '@/modules/wash/server/queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function WashRoute() {
  const user = await requireAdmin();
  const [records, vehicles] = await Promise.all([
    listWashRecordsForUser(user.id),
    listVehicleOptionsForUser(user.id),
  ]);

  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Мойка' }]}>
      <WashPage records={records} vehicles={vehicles} />
    </AppShell>
  );
}
