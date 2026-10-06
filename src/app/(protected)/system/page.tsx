import { requireAdmin } from '@/modules/auth/dal';
import { notFound } from 'next/navigation';
import { canViewMonitor } from '@/modules/system-health/monitor-model';
import { MonitorDashboard } from '@/modules/system-health/MonitorDashboard';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function SystemPage() {
  const user = await requireAdmin();
  if (!canViewMonitor(user)) notFound();

  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Состояние системы' }]}>
      <MonitorDashboard />
    </AppShell>
  );
}
