import { notFound } from 'next/navigation';

import { canManageClient, getClientAccess, requireClientAccess } from '@/modules/clients/access';
import { ClientDetailPage } from '@/modules/clients/components/ClientDetailPage';
import { getClientById, getClientCompanyOptions } from '@/modules/clients/server/queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function ClientRoute({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, access, manageAccess] = await Promise.all([
    params,
    requireClientAccess('VIEW_CLIENTS'),
    getClientAccess('MANAGE_CLIENTS'),
  ]);
  const client = await getClientById(access, id);
  if (!client) notFound();
  const canManage = canManageClient(manageAccess, client.companyId);
  const companies = canManage && manageAccess ? await getClientCompanyOptions(manageAccess) : [];
  return (
    <AppShell
      breadcrumbs={[
        { label: 'Pilot+', href: '/' },
        { label: 'Клиенты', href: '/clients' },
        { label: client.fullName },
      ]}
    >
      <ClientDetailPage client={client} canManage={canManage} companies={companies} />
    </AppShell>
  );
}
