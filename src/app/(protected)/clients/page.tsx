import { getClientAccess, requireClientAccess } from '@/modules/clients/access';
import { ClientPage } from '@/modules/clients/components/ClientPage';
import { normalizeClientSearchParams } from '@/modules/clients/components/client-query';
import { getClientCompanyOptions, getClients } from '@/modules/clients/server/queries';
import { listClientRatings } from '@/modules/client-rating/queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = normalizeClientSearchParams(await searchParams);
  const access = await requireClientAccess('VIEW_CLIENTS');
  const manageAccess = await getClientAccess('MANAGE_CLIENTS');
  const [result, companies] = await Promise.all([
    getClients(access, filters),
    manageAccess ? getClientCompanyOptions(manageAccess) : Promise.resolve([]),
  ]);
  const ratings = manageAccess
    ? Object.fromEntries(
        await listClientRatings(
          manageAccess,
          result.items.map((client) => client.id),
        ).then((items) => [...items.entries()]),
      )
    : {};
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Клиенты' }]}>
      <ClientPage
        result={result}
        filters={filters}
        canManage={Boolean(manageAccess)}
        companies={companies}
        ratings={ratings}
      />
    </AppShell>
  );
}
