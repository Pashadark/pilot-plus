import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Skeleton } from '@/shared/ui';

export default function FinesLoading() {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Штрафы' }]}>
      <div aria-label="Загрузка штрафов" className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    </AppShell>
  );
}
