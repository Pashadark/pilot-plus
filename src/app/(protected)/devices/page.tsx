import { GlonassDevicesPage } from '@/modules/devices/components/GlonassDevicesPage';
import { getGlonassDevicePageData } from '@/modules/devices/server/glonass-queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function DevicesRoute() {
  const data = await getGlonassDevicePageData();
  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Устройства' }]}>
      <GlonassDevicesPage data={data} />
    </AppShell>
  );
}
