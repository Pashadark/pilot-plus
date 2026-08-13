import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Skeleton } from '@/shared/ui';
export default function Loading() {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Аренда' }]}>
      <main className="grid gap-5 p-4 sm:p-6" aria-label="Загрузка договоров аренды">
        <Skeleton className="h-20" />
        <Skeleton className="h-12" />
        <Skeleton className="h-80" />
      </main>
    </AppShell>
  );
}
