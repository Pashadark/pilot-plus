import { AppShell } from '@/shared/components/app-shell/AppShell';
import { requireClientAccess } from '@/modules/clients/access';
import { RentalConstructor } from '@/modules/rentals/constructor/components/RentalConstructor';
import { getRentalConstructorBootstrap } from '@/modules/rentals/constructor/server/bootstrap';

export default async function NewRentalPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; company?: string }>;
}) {
  const { client, company } = await searchParams;
  const access = await requireClientAccess('VIEW_CLIENTS');
  const bootstrap = await getRentalConstructorBootstrap(access, {
    preferredCompanyId: company,
    preferredClientId: client,
  });

  return (
    <AppShell
      breadcrumbs={[
        { label: 'СУПА ПРО', href: '/' },
        { label: 'Аренда', href: '/rentals' },
        { label: 'Новый договор' },
      ]}
    >
      <RentalConstructor bootstrap={bootstrap} />
    </AppShell>
  );
}
