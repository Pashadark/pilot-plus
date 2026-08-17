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
import { getClientRentalWorkspace } from '@/modules/clients/server/client-rentals';
import { listClientComments } from '@/modules/client-comments/queries';
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
  const [companies, documents, canArchiveDocuments, rentalWorkspace, comments] = await Promise.all([
    canManage && manageAccess ? getClientCompanyOptions(manageAccess) : [],
    getClientDocuments(access, client.id),
    canArchiveClient(manageAccess, client.companyId),
    rentalAccess && canAccessRentalCompany(rentalAccess, client.companyId)
      ? getClientRentalWorkspace(rentalAccess, client.id)
      : Promise.resolve({
          summary: { total: 0, active: 0, completed: 0, totalMinor: '0' },
          rentals: [],
        }),
    manageAccess && canManage ? listClientComments(manageAccess, client.id) : Promise.resolve([]),
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
        rentalWorkspace={rentalWorkspace}
        comments={comments}
        currentUserId={access.user.id}
        canHideAnyComment={canArchiveDocuments}
      />
    </AppShell>
  );
}
