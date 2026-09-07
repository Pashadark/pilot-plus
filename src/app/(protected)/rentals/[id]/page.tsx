import { notFound } from 'next/navigation';
import { AppShell } from '@/shared/components/app-shell/AppShell';
import { RentalDetailPanel } from '@/modules/rentals/components/RentalDetailPanel';
import { RentalDetailWorkspace } from '@/modules/rentals/components/RentalDetailWorkspace';
import { RentalActionRail } from '@/modules/rentals/components/RentalActionRail';
import { RentalOperationTimeline } from '@/modules/rentals/components/RentalOperationTimeline';
import { RentalSettlementCard } from '@/modules/rentals/settlement/components/RentalSettlementCard';
import {
  getRentalDetailForCurrentUser,
  listRentalAuditForCurrentUser,
} from '@/modules/rentals/server/queries';
import { rentalDetailPresentation } from '@/modules/rentals/components/rental-detail-presentation';
import { evaluateHandoverReadiness } from '@/modules/rentals/readiness/evaluate-handover-readiness';
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
  const confirmedRentMinor = rental.payments
    .filter((payment) => payment.kind === 'RENT' && payment.status === 'CONFIRMED')
    .reduce((total, payment) => total + payment.amountMinor, BigInt(0));
  const confirmedDepositMinor = rental.payments
    .filter((payment) => payment.kind === 'DEPOSIT' && payment.status === 'CONFIRMED')
    .reduce((total, payment) => total + payment.amountMinor, BigInt(0));
  const requiredDepositMinor = rental.depositMinor ?? BigInt(0);
  const handoverReadiness = evaluateHandoverReadiness({
    rentalStatus: rental.status,
    occurredAt: new Date(),
    hasCommittedPdf: rental.documentVersions.some((document) => document.format === 'PDF'),
    clientSigned: rental.signatures.some(
      (signature) => signature.party === 'CLIENT' && signature.status === 'SIGNED',
    ),
    companySigned: rental.signatures.some(
      (signature) => signature.party === 'COMPANY' && signature.status === 'SIGNED',
    ),
    totalPriceMinor: rental.totalPriceMinor,
    confirmedRentMinor,
    requiredDepositMinor,
    confirmedDepositMinor,
    selectedDepositStatus:
      requiredDepositMinor === BigInt(0) || confirmedDepositMinor >= requiredDepositMinor
        ? 'COLLECTED'
        : 'NOT_COLLECTED',
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
          <RentalSettlementCard
            companyId={rental.companyId}
            rentalId={rental.id}
            currency={rental.currency}
            totalPriceMinor={rental.totalPriceMinor.toString()}
            depositRequiredMinor={rental.depositMinor?.toString() ?? null}
            canEdit={rental.canEdit ?? false}
            payments={rental.payments.map((payment) => ({
              id: payment.id,
              kind: payment.kind,
              status: payment.status,
              amountMinor: payment.amountMinor.toString(),
              method: payment.method,
              recordedAt: payment.recordedAt.toISOString(),
              actorName: payment.recordedBy.name,
            }))}
            signatures={rental.signatures.map((signature) => ({
              party: signature.party,
              status: signature.status,
              signedByName: signature.signedByName,
              signedAt: signature.signedAt?.toISOString() ?? null,
              actorName: signature.recordedBy.name,
            }))}
          />
          <RentalOperationTimeline
            rentalId={rental.id}
            operations={(rental.operations ?? []).map((operation) => ({
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
              docxReady: Boolean(item.docxSha256),
              pdfReady: Boolean(item.pdfSha256),
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
          canEdit={rental.canEdit ?? false}
          rental={{ id: rental.id, companyId: rental.companyId, status: rental.status }}
          handoverReadiness={handoverReadiness}
        />
      </main>
    </AppShell>
  );
}
