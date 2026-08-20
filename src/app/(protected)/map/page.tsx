import type { Metadata } from 'next';

import { requireAdmin } from '@/modules/auth/dal';
import { OnlineMapWorkspace } from '@/modules/online-map/components/OnlineMapWorkspace';
import { listOnlineMapVehicles } from '@/modules/online-map/server/queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export const metadata: Metadata = { title: 'Онлайн-карта | Pilot+' };

export default async function OnlineMapPage() {
  const user = await requireAdmin();
  const vehicles = await listOnlineMapVehicles(user);

  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Онлайн-карта' }]}>
      <main className="relative -m-4 lg:-m-5">
        <h1 className="sr-only">Онлайн-карта</h1>
        <OnlineMapWorkspace vehicles={vehicles} />
      </main>
    </AppShell>
  );
}
