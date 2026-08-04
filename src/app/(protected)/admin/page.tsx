import { getAdminCenterAccess } from '@/modules/admin/access';
import { AdminOverviewPage, getAdminOverview } from '@/modules/admin/overview';
import { AppShell } from '@/shared/components/app-shell/AppShell';
import { ForbiddenState } from '@/shared/ui';

export default async function AdminPage() {
  const access = await getAdminCenterAccess();

  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Администрирование' }]}>
      {access ? <AdminOverviewPage overview={await getAdminOverview(access)} /> : <ForbiddenState />}
    </AppShell>
  );
}
