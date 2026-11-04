import { AppShell } from '@/shared/components/app-shell/AppShell';
import { FinesPage } from '@/modules/fines/components/FinesPage';
import { listFinesForCurrentUser } from '@/modules/fines/server/queries';

export default async function FinesRoute({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    query?: string;
    companyId?: string;
    sync?: string;
    offenseFrom?: string;
    offenseTo?: string;
    vehicleId?: string;
    clientId?: string;
    page?: string;
    pageSize?: string;
    payment?: string;
    discountDay?: string;
  }>;
}) {
  const filters = await searchParams;
  const data = await listFinesForCurrentUser(filters);
  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Штрафы' }]}>
      <FinesPage
        referenceTime={new Date().toISOString()}
        summary={data.summary}
        deadlineDays={data.deadlineDays}
        fines={data.fines}
        tollsUnavailable={data.tollsUnavailable}
        companies={data.companies}
        vehicles={data.vehicles}
        clients={data.clients}
        selectedCompanyId={data.selectedCompanyId}
        canSync={data.canSync}
        canManage={data.canManage}
        canPay={data.canPay}
        filters={data.filters}
        pagination={data.pagination}
        syncOutcome={
          filters.sync === 'success' ? 'success' : filters.sync === 'error' ? 'error' : undefined
        }
        paymentOutcome={
          filters.payment === 'returned'
            ? 'returned'
            : filters.payment === 'failed'
              ? 'failed'
              : filters.payment === 'invalid'
                ? 'invalid'
                : undefined
        }
      />
    </AppShell>
  );
}
