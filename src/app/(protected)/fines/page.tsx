import { AppShell } from '@/shared/components/app-shell/AppShell';
import { FinesPage } from '@/modules/fines/components/FinesPage';
import { listFinesForCurrentUser } from '@/modules/fines/server/queries';

export default async function FinesRoute({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; query?: string; companyId?: string }>;
}) {
  const filters = await searchParams;
  const data = await listFinesForCurrentUser(filters);
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Штрафы' }]}>
      <FinesPage summary={data.summary} fines={data.fines} />
    </AppShell>
  );
}
