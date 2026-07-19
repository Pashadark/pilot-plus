import Link from 'next/link';

import { AppShell } from '@/shared/components/app-shell/AppShell';
import { EmptyState } from '@/shared/ui';

export default function VehicleNotFound() {
  return <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Автомобили', href: '/vehicles' }, { label: 'Не найден' }]}><main className="p-4 sm:p-6"><EmptyState title="Автомобиль не найден" description="Запись не существует или недоступна вашей компании." action={<Link href="/vehicles" className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 font-semibold text-[var(--color-text-inverse)]">Вернуться к автопарку</Link>} /></main></AppShell>;
}
