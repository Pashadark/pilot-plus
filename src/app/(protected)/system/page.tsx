import { getSystemHealth } from '@/modules/system-health/get-system-health';
import { SystemHealthPage } from '@/modules/system-health/SystemHealthPage';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function SystemPage() {
  const services = await getSystemHealth();

  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Состояние системы' }]}>
      <SystemHealthPage services={services} />
    </AppShell>
  );
}
