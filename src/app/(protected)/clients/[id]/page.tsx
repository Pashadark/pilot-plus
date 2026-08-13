import { notFound } from 'next/navigation';

import { getClientDocuments } from '@/modules/client-documents/server/queries';
import {
  canArchiveClient,
  canManageClient,
  getClientAccess,
  requireClientAccess,
} from '@/modules/clients/access';
import { ClientDetailPage } from '@/modules/clients/components/ClientDetailPage';
import { getClientById, getClientCompanyOptions } from '@/modules/clients/server/queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';
import { canAccessRentalCompany, getRentalAccess } from '@/modules/rentals/server/access';

export default async function ClientRoute({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, access, manageAccess, rentalAccess] = await Promise.all([
    params,
    requireClientAccess('VIEW_CLIENTS'),
    getClientAccess('MANAGE_CLIENTS'),
    getRentalAccess(),
  ]);
  const client = await getClientById(access, id);
  if (!client) notFound();
  const canManage = canManageClient(manageAccess, client.companyId);
  const [companies, documents, canArchiveDocuments] = await Promise.all([
    canManage && manageAccess ? getClientCompanyOptions(manageAccess) : [],
    getClientDocuments(access, client.id),
    canArchiveClient(manageAccess, client.companyId),
  ]);
  return (
    <AppShell
      breadcrumbs={[
        { label: 'Pilot+', href: '/' },
        { label: 'Клиенты', href: '/clients' },
        { label: client.fullName },
      ]}
    >
      <ClientDetailPage
        client={client}
        canManage={canManage}
        canArchiveDocuments={canArchiveDocuments}
        documents={documents}
        companies={companies}
        canCreateRental={canAccessRentalCompany(rentalAccess, client.companyId)}
      />
    </AppShell>
  );
}
