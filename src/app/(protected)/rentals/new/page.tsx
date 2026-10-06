import { AppShell } from '@/shared/components/app-shell/AppShell';
import { requireClientAccess } from '@/modules/clients/access';
import { getClients } from '@/modules/clients/server/queries';
import { NewRentalClientPicker } from '@/modules/rentals/components/NewRentalClientPicker';

export default async function NewRentalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const access = await requireClientAccess('VIEW_CLIENTS');
  const result = await getClients(access, { q, page: 1, pageSize: 30 });

  return (
    <AppShell
      breadcrumbs={[
        { label: 'СУПА ПРО', href: '/' },
        { label: 'Аренда', href: '/rentals' },
        { label: 'Новый договор' },
      ]}
    >
      <NewRentalClientPicker
        query={q}
        clients={result.items.map((client) => ({
          id: client.id,
          fullName: client.fullName,
          phone: client.phone,
          status: client.status,
        }))}
      />
    </AppShell>
  );
}
