import { AppShell } from '@/shared/components/app-shell/AppShell';
import { getDepositWorkspace } from '@/modules/deposits/server/queries';
import { DepositsWorkspace } from '@/modules/deposits/workspace/DepositsWorkspace';
import { filterDepositRows, type DepositWorkspaceFilter } from '@/modules/deposits/workspace/model';

export default async function DepositsRoute({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; filter?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 120) : '';
  const rawFilter = typeof params.filter === 'string' ? params.filter : 'all';
  const filter: DepositWorkspaceFilter = ['urgent', 'soon', 'active', 'returned', 'debt'].includes(
    rawFilter,
  )
    ? (rawFilter as DepositWorkspaceFilter)
    : 'all';
  const workspace = await getDepositWorkspace();
  const rows = filterDepositRows(workspace.rows, { query, filter });
  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Залоги' }]}>
      <DepositsWorkspace rows={rows} summary={workspace.summary} query={query} filter={filter} />
    </AppShell>
  );
}
