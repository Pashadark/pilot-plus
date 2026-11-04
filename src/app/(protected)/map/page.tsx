import type { Metadata } from 'next';

import { requireAdmin } from '@/modules/auth/dal';
import { OnlineMapWorkspace } from '@/modules/online-map/components/OnlineMapWorkspace';
import { listOnlineMapVehicles } from '@/modules/online-map/server/queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export const metadata: Metadata = { title: 'Онлайн-карта | СУПА ПРО' };

export default async function OnlineMapPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string; date?: string; eventId?: string }>;
}) {
  const user = await requireAdmin();
  const { vehicleId, date, eventId } = await searchParams;
  const vehicles = await listOnlineMapVehicles(user);
  const selectedVehicleId = vehicles.some((vehicle) => vehicle.id === vehicleId) ? vehicleId : null;
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date : null;

  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Онлайн-карта' }]}>
      <main className="relative -m-4 lg:-m-5">
        <h1 className="sr-only">Онлайн-карта</h1>
        <OnlineMapWorkspace
          vehicles={vehicles}
          initialSelectedVehicleId={selectedVehicleId}
          initialTrackDate={selectedVehicleId ? selectedDate : null}
          initialSelectedEventId={selectedVehicleId && selectedDate ? (eventId ?? null) : null}
        />
      </main>
    </AppShell>
  );
}
