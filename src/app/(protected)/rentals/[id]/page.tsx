import { vehicleName } from '@/shared/lib/vehicle-name';
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
import {
  isCompleteWeeklyInspection,
  moscowWeekRange,
  nextFridayMorning,
} from '@/modules/rentals/lease-to-own/weekly-inspection';
export default async function RentalDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ action?: string; settlement?: string }>;
}) {
  const [{ id }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<{ action?: string; settlement?: string }>({}),
  ]);
  const rental = await getRentalDetailForCurrentUser(id);
  if (!rental) notFound();
  const initialAction =
    query.action === 'extend'
      ? 'EXTENSION'
      : query.action === 'return'
        ? 'RETURN'
        : query.action === 'weekly-inspection'
          ? 'WEEKLY_INSPECTION'
          : null;
  const defaultPaymentKind = query.settlement === 'deposit' ? 'DEPOSIT' : 'RENT';
  const client = [rental.client.lastName, rental.client.firstName, rental.client.middleName]
    .filter(Boolean)
    .join(' ');
  const history = await listRentalAuditForCurrentUser(rental.companyId, rental.id);
  const detail = rentalDetailPresentation({
    id: rental.id,
    contractNumber: rental.contractNumber,
    status: rental.status,
    agreementType: rental.agreementType,
    snapshot: rental.snapshot,
    clientId: rental.clientId,
    clientLabel: client,
    vehicleId: rental.vehicleId,
    vehicleLabel: [
      vehicleName(rental.vehicle.make, rental.vehicle.modelName),
      rental.vehicle.registrationNumber,
    ]
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
  const currentWeek = moscowWeekRange(new Date());
  const weeklyInspections = rental.operations.filter(
    (operation) => operation.type === 'WEEKLY_INSPECTION',
  );
  const currentWeekInspection = weeklyInspections.find(
    (operation) =>
      operation.occurredAt >= currentWeek.start &&
      operation.occurredAt < currentWeek.end &&
      isCompleteWeeklyInspection(operation.media.map((medium) => medium.kind)),
  );
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
          {rental.agreementType === 'LEASE_TO_OWN' ? (
            <section className="rounded-xl border border-[#673AB7]/30 bg-[#673AB7]/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="inline-flex rounded-full bg-[#673AB7] px-3 py-1 text-xs font-bold text-white">
                    С правом выкупа
                  </span>
                  <h2 className="mt-3 text-lg font-bold">Еженедельный контроль автомобиля</h2>
                </div>
                <a
                  href={`?action=weekly-inspection#rental-actions`}
                  className="inline-flex min-h-10 items-center rounded-lg bg-[#673AB7] px-4 text-sm font-semibold text-white"
                >
                  Добавить осмотр
                </a>
              </div>
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                {currentWeekInspection
                  ? `За эту неделю выполнен ${new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' }).format(currentWeekInspection.occurredAt)}.`
                  : `За эту неделю осмотр ещё не загружен. Следующее напоминание: ${new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'medium', timeStyle: 'short' }).format(nextFridayMorning(new Date()))}.`}
              </p>
            </section>
          ) : null}
          <RentalDetailWorkspace detail={detail} />
          <RentalSettlementCard
            companyId={rental.companyId}
            rentalId={rental.id}
            currency={rental.currency}
            totalPriceMinor={rental.totalPriceMinor.toString()}
            depositRequiredMinor={rental.depositMinor?.toString() ?? null}
            canEdit={rental.canEdit ?? false}
            rentalStatus={rental.status}
            depositResolved={rental.operations.some((operation) =>
              ['RETURNED', 'PARTIALLY_WITHHELD', 'WITHHELD'].includes(
                operation.depositStatus ?? '',
              ),
            )}
            defaultPaymentKind={defaultPaymentKind}
            payments={rental.payments.map((payment) => ({
              id: payment.id,
              kind: payment.kind,
              status: payment.status,
              amountMinor: payment.amountMinor.toString(),
              method: payment.method,
              recordedAt: payment.recordedAt.toISOString(),
              actorName: payment.recordedBy.name,
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
              depositAmountMinor: operation.depositAmountMinor?.toString() ?? null,
              depositWithheldMinor: operation.depositWithheldMinor?.toString() ?? null,
              depositStatus: operation.depositStatus,
              depositResolutionReason: operation.depositResolutionReason,
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
          key={`${rental.id}:${initialAction ?? 'none'}`}
          canEdit={rental.canEdit ?? false}
          initialAction={initialAction}
          rental={{
            id: rental.id,
            companyId: rental.companyId,
            status: rental.status,
            agreementType: rental.agreementType,
            endsAt: rental.endsAt.toISOString(),
            vehicleLabel: [
              vehicleName(rental.vehicle.make, rental.vehicle.modelName),
              rental.vehicle.registrationNumber,
            ]
              .filter(Boolean)
              .join(' · '),
          }}
          handoverReadiness={handoverReadiness}
        />
      </main>
    </AppShell>
  );
}
