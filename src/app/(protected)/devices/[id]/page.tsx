import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DeviceDetailPage } from '@/modules/devices/components/DeviceDetailPage';
import { getAvailableVehicles, getDeviceDetails } from '@/modules/devices/server/queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export const metadata: Metadata = { title: 'Устройство Pilot Connect | Pilot+' };

export default async function DeviceRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const device = await getDeviceDetails(id);
  if (!device) notFound();
  const availableVehicles = await getAvailableVehicles(device.id);

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Pilot+', href: '/' },
        { label: 'Устройства', href: '/devices' },
        { label: device.name },
      ]}
    >
      <DeviceDetailPage device={device} availableVehicles={availableVehicles} />
    </AppShell>
  );
}
