import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Card, Skeleton } from '@/shared/ui';

export default function SystemLoading() {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Состояние системы' }]}>
      <section aria-label="Проверка состояния системы" className="grid min-w-0 gap-5 p-4 sm:p-6">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-5 w-[36rem] max-w-full" />
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index} className="grid min-w-0 gap-4 p-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-5 w-36 max-w-full" />
              <Skeleton className="h-16 w-full" />
            </Card>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
