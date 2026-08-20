import { notFound } from 'next/navigation';

import { prisma } from '@/database/prisma/client';
import { requireClientAccess } from '@/modules/clients/access';
import { getClientById } from '@/modules/clients/server/queries';
import { RentalWizard } from '@/modules/rentals/components/RentalWizard';
import { requireRentalAccess } from '@/modules/rentals/server/access';
import { listRentalDraftVehicleOptions } from '@/modules/rentals/server/draft-vehicle-options';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function NewRentalRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientAccess = await requireClientAccess('VIEW_CLIENTS');
  const client = await getClientById(clientAccess, id);
  if (!client) notFound();
  await requireRentalAccess(client.companyId);
  const [vehicles, template, clientDocuments] = await Promise.all([
    listRentalDraftVehicleOptions(client.companyId),
    prisma.contractTemplateVersion.findFirst({
      where: { companyId: client.companyId, isPublished: true },
      orderBy: { publishedAt: 'desc' },
      select: { id: true },
    }),
    prisma.clientDocument.findMany({
      where: {
        companyId: client.companyId,
        clientId: client.id,
        archivedAt: null,
        category: { in: ['PASSPORT', 'DRIVER_LICENSE'] },
        status: 'CLEAN',
      },
      select: {
        category: true,
        currentVersion: true,
        versions: { where: { scanVerdict: 'CLEAN' }, select: { version: true } },
      },
    }),
  ]);
  const documentsReady = new Set(
    clientDocuments
      .filter((document) =>
        document.versions.some((version) => version.version === document.currentVersion),
      )
      .map((document) => document.category),
  );
  return (
    <AppShell
      breadcrumbs={[
        { label: 'Pilot+', href: '/' },
        { label: 'Клиенты', href: '/clients' },
        { label: client.fullName, href: `/clients/${client.id}` },
        { label: 'Новый договор' },
      ]}
    >
      <RentalWizard
        client={{
          ...client,
          documentsReady: documentsReady.has('PASSPORT') && documentsReady.has('DRIVER_LICENSE'),
        }}
        templateVersionId={template?.id ?? null}
        vehicles={vehicles}
      />
    </AppShell>
  );
}
