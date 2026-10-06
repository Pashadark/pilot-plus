import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Card, Skeleton } from '@/shared/ui';

export default function SystemLoading() {
  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Состояние системы' }]}>
      <section aria-label="Проверка состояния системы" className="grid min-w-0 gap-5 p-4 sm:p-6">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-5 w-[36rem] max-w-full" />
        </div>
        <Card className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </Card>
        <div className="grid gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <Card key={index} className="grid min-w-0 gap-4 p-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-5 w-36 max-w-full" />
              <Skeleton className="h-16 w-full" />
            </Card>
          ))}
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-72 max-w-full" />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Card key={index} className="grid min-w-0 gap-4 p-5">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </Card>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
