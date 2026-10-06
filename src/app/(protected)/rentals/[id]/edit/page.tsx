import { notFound } from 'next/navigation';

import { RentalTermsEditor } from '@/modules/rentals/edit/components/RentalTermsEditor';
import { getRentalEditForCurrentUser } from '@/modules/rentals/edit/server/get-rental-edit';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function RentalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const rental = await getRentalEditForCurrentUser((await params).id);
  if (!rental) notFound();
  return (
    <AppShell
      breadcrumbs={[
        { label: 'СУПА ПРО', href: '/' },
        { label: 'Аренда', href: '/rentals' },
        { label: rental.contractNumber ?? 'Черновик', href: `/rentals/${rental.id}` },
        { label: 'Редактирование' },
      ]}
    >
      <main className="grid gap-5 p-4 sm:p-6">
        <header>
          <p className="text-sm font-semibold text-[var(--color-primary)]">Условия договора</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Редактирование договора</h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Клиент, номер и статус защищены от изменения.
          </p>
        </header>
        <RentalTermsEditor rental={rental} />
      </main>
    </AppShell>
  );
}
