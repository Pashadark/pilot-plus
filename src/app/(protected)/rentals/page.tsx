import { AppShell } from '@/shared/components/app-shell/AppShell';
import { RentalListPage } from '@/modules/rentals/components/RentalListPage';
import { RentalCalendar } from '@/modules/rentals/components/RentalCalendar';
import { listFilteredRentalsForCurrentUser } from '@/modules/rentals/server/queries';
export default async function RentalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    query?: string;
    from?: string;
    to?: string;
    view?: string;
  }>;
}) {
  const filters = await searchParams;
  const records = await listFilteredRentalsForCurrentUser(filters);
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Аренда' }]}>
      {filters.view === 'calendar' ? (
        <main className="grid gap-5 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold sm:text-3xl">Календарь аренды</h1>
            <a
              className="min-h-11 content-center rounded-xl border px-4 font-semibold"
              href="/rentals"
            >
              Вернуться к списку
            </a>
          </div>
          <RentalCalendar
            month={new Date().toISOString().slice(0, 7)}
            rentals={records.map((r) => ({
              id: r.id,
              startsAt: r.startsAt.toISOString(),
              endsAt: r.endsAt.toISOString(),
              status: r.status,
              vehicleLabel: [r.vehicle.make, r.vehicle.modelName, r.vehicle.registrationNumber]
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
          rentals={records.map((r) => ({
            id: r.id,
            startsAt: r.startsAt.toISOString(),
            endsAt: r.endsAt.toISOString(),
            status: r.status,
            contractNumber: r.contractNumber,
            totalPriceMinor: r.totalPriceMinor,
            depositMinor: r.depositMinor,
            currency: r.currency,
            hasExtension: r.operations.length > 0,
            documentFormats: [...new Set(r.documentVersions.map((document) => document.format))],
            vehicleLabel: [r.vehicle.make, r.vehicle.modelName, r.vehicle.registrationNumber]
              .filter(Boolean)
              .join(' · '),
            clientLabel: [r.client.lastName, r.client.firstName, r.client.middleName]
              .filter(Boolean)
              .join(' '),
          }))}
          filters={filters}
        />
      )}
    </AppShell>
  );
}
