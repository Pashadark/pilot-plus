import { DevicesPage } from '@/modules/devices/components/DevicesPage';
import { getDevicePageData } from '@/modules/devices/server/queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function DevicesRoute() {
  const data = await getDevicePageData();
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Устройства' }]}>
      <DevicesPage data={data} />
    </AppShell>
  );
}
