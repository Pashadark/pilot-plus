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
    id: rental.id,
    contractNumber: rental.contractNumber,
    status: rental.status,
    snapshot: rental.snapshot,
    clientId: rental.clientId,
    clientLabel: client,
    vehicleId: rental.vehicleId,
    vehicleLabel: [rental.vehicle.make, rental.vehicle.modelName, rental.vehicle.registrationNumber]
      .filter(Boolean)
      .join(' · '),
    startsAt: rental.startsAt.toISOString(),
    endsAt: rental.endsAt.toISOString(),
    createdAt: rental.createdAt.toISOString(),
    updatedAt: rental.updatedAt.toISOString(),
    confirmedAt: rental.confirmedAt?.toISOString() ?? null,
    activatedAt: rental.activatedAt?.toISOString() ?? null,
    completedAt: rental.completedAt?.toISOString() ?? null,
    cancelledAt: rental.cancelledAt?.toISOString() ?? null,
    currency: rental.currency,
    dailyRateMinor: rental.dailyRateMinor,
    billableDays: rental.billableDays,
    basePriceMinor: rental.basePriceMinor,
    discountMinor: rental.discountMinor,
    servicesMinor: rental.servicesMinor,
    totalPriceMinor: rental.totalPriceMinor,
    depositMinor: rental.depositMinor,
    includedMileageKm: rental.includedMileageKm,
    overageMileagePriceMinor: rental.overageMileagePriceMinor,
    missingFuelPriceMinor: rental.missingFuelPriceMinor,
    priceOverrideReason: rental.priceOverrideReason,
    drivers: rental.drivers.map((driver) => {
      const snapshot =
        typeof driver.snapshot === 'object' &&
        driver.snapshot !== null &&
        !Array.isArray(driver.snapshot)
          ? (driver.snapshot as Record<string, unknown>)
          : null;
      return {
        id: driver.id,
        label:
          typeof snapshot?.fullName === 'string' && snapshot.fullName.trim()
            ? snapshot.fullName
            : 'Допущенный водитель',
      };
    }),
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
            <dd>{detail.source.label}</dd>
          </div>
          <div>
            <dt>Клиент</dt>
            <dd>{detail.client.label}</dd>
          </div>
          <div>
            <dt>Автомобиль</dt>
            <dd>{detail.vehicle.label}</dd>
          </div>
          <div>
            <dt>Статус</dt>
            <dd>{detail.status.label}</dd>
          </div>
          <div>
            <dt>Срок</dt>
            <dd>
              {detail.term.startsAt} — {detail.term.endsAt}
            </dd>
          </div>
          <div>
            <dt>Итог</dt>
            <dd>{detail.finance.total}</dd>
          </div>
          <div>
            <dt>Выдача / возврат</dt>
            <dd>
              {detail.operations.pickupAddress} / {detail.operations.returnAddress}
            </dd>
          </div>
          {Object.values(detail.operations).some((value) => value !== 'Не указано') ? (
            <div>
              <dt>Условия выдачи</dt>
              <dd>
                {Object.entries(detail.operations)
                  .filter(
                    ([, value]) =>
                      value !== 'Не указано' && (!Array.isArray(value) || value.length),
                  )
                  .map(([, value]) => (Array.isArray(value) ? value.join(', ') : value))
                  .join(' · ') || 'Не указано'}
              </dd>
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
