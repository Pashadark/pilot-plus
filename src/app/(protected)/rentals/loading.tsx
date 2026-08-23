import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Skeleton } from '@/shared/ui';
export default function Loading() {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Аренда' }]}>
      <main className="grid gap-5 p-4 sm:p-6" aria-label="Загрузка договоров аренды">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-16 w-64" />
          <Skeleton className="h-11 w-80" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-16 rounded-2xl" />
        <div className="grid gap-2 rounded-2xl border p-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-xl" />
          ))}
        </div>
      </main>
    </AppShell>
  );
}
