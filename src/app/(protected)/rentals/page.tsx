import { vehicleName } from '@/shared/lib/vehicle-name';
import Link from 'next/link';

import { AppShell } from '@/shared/components/app-shell/AppShell';
import { RentalListPage } from '@/modules/rentals/components/RentalListPage';
import { RentalCalendar } from '@/modules/rentals/components/RentalCalendar';
import { listFilteredRentalsForCurrentUser } from '@/modules/rentals/server/queries';
import { decryptField } from '@/services/security/field-encryption';

function clientPhone(value: string | null) {
  if (!value) return null;
  const key = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  if (!key) return null;
  try {
    return decryptField(value, key);
  } catch {
    return null;
  }
}

export default async function RentalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    query?: string;
    vehicleId?: string;
    from?: string;
    to?: string;
    view?: string;
    archive?: string;
    important?: string;
  }>;
}) {
  const filters = await searchParams;
  const records = await listFilteredRentalsForCurrentUser(filters);
  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Договоры аренды' }]}>
      {filters.view === 'calendar' ? (
        <main className="grid gap-5 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold sm:text-3xl">Календарь аренды</h1>
            <Link
              className="min-h-11 content-center rounded-xl border px-4 font-semibold"
              href="/rentals"
            >
              Вернуться к списку
            </Link>
          </div>
          <RentalCalendar
            month={new Date().toISOString().slice(0, 7)}
            rentals={records.map((r) => ({
              id: r.id,
              startsAt: r.startsAt.toISOString(),
              endsAt: r.endsAt.toISOString(),
              status: r.status,
              agreementType: r.agreementType,
              vehicleLabel: [
                vehicleName(r.vehicle.make, r.vehicle.modelName),
                r.vehicle.registrationNumber,
              ]
                .filter(Boolean)
                .join(' · '),
              clientLabel: [r.client.lastName, r.client.firstName, r.client.middleName]
                .filter(Boolean)
                .join(' '),
            }))}
          />
        </main>
      ) : (
        <RentalListPage
          now={new Date().toISOString()}
          rentals={records.map((r) => {
            const latestDepositOperation = r.operations.find(
              (operation) => operation.depositStatus !== null,
            );
            return {
              id: r.id,
              clientId: r.client.id,
              vehicleId: r.vehicle.id,
              startsAt: r.startsAt.toISOString(),
              endsAt: r.endsAt.toISOString(),
              completedAt: r.completedAt?.toISOString() ?? null,
              status: r.status,
              agreementType: r.agreementType,
              contractNumber: r.contractNumber,
              dailyRateMinor: r.dailyRateMinor,
              totalPriceMinor: r.totalPriceMinor,
              depositMinor: r.depositMinor,
              currency: r.currency,
              hasExtension: r.operations.some((operation) => operation.type === 'EXTENSION'),
              payments: r.payments.map((payment) => ({
                kind: payment.kind,
                amountMinor: payment.amountMinor,
              })),
              depositStatus: latestDepositOperation?.depositStatus ?? null,
              depositWithheldMinor: latestDepositOperation?.depositWithheldMinor ?? null,
              documentFormats: [...new Set(r.documentVersions.map((document) => document.format))],
              documents: r.documentVersions.map((document) => ({
                format: document.format,
                version: document.version,
              })),
              vehicleName: vehicleName(r.vehicle.make, r.vehicle.modelName) || r.vehicle.model,
              registrationNumber: r.vehicle.registrationNumber ?? 'Не указан',
              vehicleInternalNumber: r.vehicle.internalNumber,
              vehicleCity: r.vehicle.city,
              vehicleImage: r.vehicle.images[0] ?? null,
              clientLabel: [r.client.lastName, r.client.firstName, r.client.middleName]
                .filter(Boolean)
                .join(' '),
              clientPhone: clientPhone(r.client.phoneEncrypted),
            };
          })}
          filters={filters}
        />
      )}
    </AppShell>
  );
}
