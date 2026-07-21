import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Card, Skeleton } from '@/shared/ui';

export default function WashLoading() {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Мойка' }]}>
      <main className="grid min-w-0 gap-5 p-4 sm:p-6" aria-label="Загрузка мойки">
        <Skeleton className="h-20" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index} className="p-4">
              <Skeleton className="h-14" />
            </Card>
          ))}
        </div>
        <Skeleton className="h-24" />
        <Skeleton className="h-80" />
      </main>
    </AppShell>
  );
}
