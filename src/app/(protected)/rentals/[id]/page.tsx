import { notFound } from 'next/navigation';
import { AppShell } from '@/shared/components/app-shell/AppShell';
import { RentalDetailPanel } from '@/modules/rentals/components/RentalDetailPanel';
import {
  getRentalDetailForCurrentUser,
  listRentalAuditForCurrentUser,
} from '@/modules/rentals/server/queries';
import { rentalDetailPresentation } from '@/modules/rentals/components/rental-detail-presentation';
export default async function RentalDetail({ params }: { params: Promise<{ id: string }> }) {
  const rental = await getRentalDetailForCurrentUser((await params).id);
  if (!rental) notFound();
  const client = [rental.client.lastName, rental.client.firstName, rental.client.middleName]
    .filter(Boolean)
    .join(' ');
  const history = await listRentalAuditForCurrentUser(rental.companyId, rental.id);
  const detail = rentalDetailPresentation({
    status: rental.status,
    snapshot: rental.snapshot,
    clientLabel: client,
    vehicleLabel: [rental.vehicle.make, rental.vehicle.modelName, rental.vehicle.registrationNumber]
      .filter(Boolean)
      .join(' · '),
    startsAt: rental.startsAt.toISOString(),
    endsAt: rental.endsAt.toISOString(),
    totalPriceMinor: rental.totalPriceMinor,
  });
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
            <dt>Источник данных</dt>
            <dd>{detail.source}</dd>
          </div>
          <div>
            <dt>Клиент</dt>
            <dd>{detail.client}</dd>
          </div>
          <div>
            <dt>Автомобиль</dt>
            <dd>{detail.vehicle}</dd>
          </div>
          <div>
            <dt>Статус</dt>
            <dd>{rental.status}</dd>
          </div>
          <div>
            <dt>Срок</dt>
            <dd>{detail.term}</dd>
          </div>
          <div>
            <dt>Итог</dt>
            <dd>{(detail.totalMinor / 100).toLocaleString('ru-RU')} ₽</dd>
          </div>
          <div>
            <dt>Выдача / возврат</dt>
            <dd>
              {detail.pickupAddress ?? '—'} / {detail.returnAddress ?? '—'}
            </dd>
          </div>
          {detail.issuance ? (
            <div>
              <dt>Условия выдачи</dt>
              <dd>{Object.values(detail.issuance).map(String).join(' · ') || '—'}</dd>
            </div>
          ) : null}
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
