import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Card, Skeleton } from '@/shared/ui';

export default function VehiclesLoading() {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Автомобили' }]}>
      <main className="grid gap-5 p-4 sm:p-6" aria-label="Загрузка автомобилей">
        <Skeleton className="h-20" />
        <Skeleton className="h-24" />
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Card key={index} className="p-4">
              <Skeleton className="h-72" />
            </Card>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
