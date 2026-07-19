import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requireAdmin } from '@/modules/auth/dal';
import { VehicleDetailPage } from '@/modules/vehicles/components/VehicleDetailPage';
import { normalizeVehicleTab } from '@/modules/vehicles/components/vehicle-tabs';
import { getVehicleForUser } from '@/modules/vehicles/server/queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export const metadata: Metadata = { title: 'Автомобиль | Pilot+' };

export default async function VehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const vehicle = await getVehicleForUser(user.id, id);
  if (!vehicle) notFound();

  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Автомобили', href: '/vehicles' }, { label: vehicle.model }]}>
      <VehicleDetailPage vehicle={vehicle} activeTab={normalizeVehicleTab(query.tab)} />
    </AppShell>
  );
}
