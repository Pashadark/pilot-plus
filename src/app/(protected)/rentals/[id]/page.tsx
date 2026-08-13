import { notFound } from 'next/navigation';
import { AppShell } from '@/shared/components/app-shell/AppShell';
import { RentalDetailPanel } from '@/modules/rentals/components/RentalDetailPanel';
import {
  getRentalDetailForCurrentUser,
  listRentalAuditForCurrentUser,
} from '@/modules/rentals/server/queries';
export default async function RentalDetail({ params }: { params: Promise<{ id: string }> }) {
  const rental = await getRentalDetailForCurrentUser((await params).id);
  if (!rental) notFound();
  const client = [rental.client.lastName, rental.client.firstName, rental.client.middleName]
    .filter(Boolean)
    .join(' ');
  const history = await listRentalAuditForCurrentUser(rental.companyId, rental.id);
  return (
    <AppShell
      breadcrumbs={[
        { label: 'Pilot+', href: '/' },
        { label: 'Аренда', href: '/rentals' },
        { label: rental.contractNumber ?? 'Черновик' },
      ]}
    >
      <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="rental-detail-page">
        <h1 className="text-2xl font-bold">{rental.contractNumber ?? 'Черновик договора'}</h1>
        <dl className="grid gap-3 rounded-[var(--radius-md)] border p-4">
          <div>
            <dt>Клиент</dt>
            <dd>{client}</dd>
          </div>
          <div>
            <dt>Автомобиль</dt>
            <dd>
              {[rental.vehicle.make, rental.vehicle.modelName, rental.vehicle.registrationNumber]
                .filter(Boolean)
                .join(' · ')}
            </dd>
          </div>
          <div>
            <dt>Статус</dt>
            <dd>{rental.status}</dd>
          </div>
        </dl>
        <RentalDetailPanel
          rental={{
            id: rental.id,
            companyId: rental.companyId,
            status: rental.status,
            contractNumber: rental.contractNumber,
          }}
          documents={rental.documentVersions}
          generations={rental.documentGenerations.map((item) => ({
            version: item.version,
            status: item.status,
            updatedAt: item.updatedAt.toISOString(),
          }))}
          history={history.map((item) => ({
            id: item.id,
            action: item.action,
            label: 'Действие с договором',
            createdAt: item.createdAt.toISOString(),
          }))}
        />
      </main>
    </AppShell>
  );
}
