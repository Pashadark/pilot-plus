import { notFound } from 'next/navigation';
import { AppShell } from '@/shared/components/app-shell/AppShell';
import { RentalDetailPanel } from '@/modules/rentals/components/RentalDetailPanel';
import { RentalDetailWorkspace } from '@/modules/rentals/components/RentalDetailWorkspace';
import { RentalActionRail } from '@/modules/rentals/components/RentalActionRail';
import { RentalOperationTimeline } from '@/modules/rentals/components/RentalOperationTimeline';
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
        { label: 'СУПА ПРО', href: '/' },
        { label: 'Аренда', href: '/rentals' },
        { label: rental.contractNumber ?? 'Черновик' },
      ]}
    >
      <main
        className="grid min-w-0 gap-5 p-4 pb-24 sm:p-6 sm:pb-24 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start xl:pb-6"
        data-testid="rental-detail-page"
      >
        <div className="grid min-w-0 gap-5">
          <RentalDetailWorkspace detail={detail} />
          <RentalOperationTimeline
            rentalId={rental.id}
            operations={rental.operations.map((operation) => ({
              id: operation.id,
              type: operation.type,
              occurredAt: operation.occurredAt.toISOString(),
              actorName: operation.actor.name,
              evidenceStatus: operation.evidenceStatus,
              evidenceMissingReason: operation.evidenceMissingReason,
              mileageKm: operation.mileageKm,
              fuelLevelPercent: operation.fuelLevelPercent,
              fulfillmentMethod: operation.fulfillmentMethod,
              fulfillmentAddress: operation.fulfillmentAddress,
              nextEndsAt: operation.nextEndsAt?.toISOString() ?? null,
              totalChargeMinor: operation.totalChargeMinor?.toString() ?? null,
              media: operation.media,
            }))}
          />
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
            source={detail.source.label}
          />
        </div>
        <RentalActionRail
          rental={{ id: rental.id, companyId: rental.companyId, status: rental.status }}
        />
      </main>
    </AppShell>
  );
}
