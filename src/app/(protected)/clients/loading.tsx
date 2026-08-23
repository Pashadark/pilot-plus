import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Card, Skeleton } from '@/shared/ui';
export default function ClientsLoading() {
  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Клиенты' }]}>
      <main aria-label="Загрузка клиентов" className="grid gap-5 p-4 sm:p-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-36" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Card key={index} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 p-4">
              <Skeleton className="size-[5.5rem]" />
              <div className="grid gap-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4" />
                <Skeleton className="h-11" />
              </div>
            </Card>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
