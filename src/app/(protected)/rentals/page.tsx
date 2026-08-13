import { AppShell } from '@/shared/components/app-shell/AppShell';
import { RentalListPage } from '@/modules/rentals/components/RentalListPage';
import { listRentalsForCurrentUser } from '@/modules/rentals/server/queries';
export default async function RentalsPage() {
  const records = await listRentalsForCurrentUser();
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Аренда' }]}>
      <RentalListPage
        rentals={records.map((r) => ({
          id: r.id,
          startsAt: r.startsAt.toISOString(),
          endsAt: r.endsAt.toISOString(),
          status: r.status,
          contractNumber: r.contractNumber,
          totalPriceMinor: r.totalPriceMinor,
          currency: r.currency,
          vehicleLabel: [r.vehicle.make, r.vehicle.modelName, r.vehicle.registrationNumber]
            .filter(Boolean)
            .join(' · '),
          clientLabel: [r.client.lastName, r.client.firstName, r.client.middleName]
            .filter(Boolean)
            .join(' '),
        }))}
      />
    </AppShell>
  );
}
