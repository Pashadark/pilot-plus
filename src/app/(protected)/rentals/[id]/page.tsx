import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/shared/components/app-shell/AppShell';
import { getRentalDetailForCurrentUser } from '@/modules/rentals/server/queries';
export default async function RentalDetail({ params }: { params: Promise<{ id: string }> }) {
  const rental = await getRentalDetailForCurrentUser((await params).id);
  if (!rental) notFound();
  const client = [rental.client.lastName, rental.client.firstName, rental.client.middleName]
    .filter(Boolean)
    .join(' ');
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
        <section>
          <h2 className="text-lg font-bold">Документы</h2>
          {rental.documentVersions.map((d) => (
            <Link
              key={`${d.version}-${d.format}`}
              className="mr-4 inline-flex min-h-11 items-center text-[var(--color-primary)]"
              href={`/rentals/${rental.id}/documents/${d.version}/${d.format}`}
            >
              Скачать {d.format} v{d.version}
            </Link>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
