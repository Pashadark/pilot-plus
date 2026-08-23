import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Card, Skeleton } from '@/shared/ui';

export default function AdminLoading() {
  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Администрирование' }]}>
      <section aria-label="Загрузка центра управления" className="grid min-w-0 gap-5 p-4 sm:p-6">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-5 w-[36rem] max-w-full" />
        </div>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index} className="flex min-w-0 items-center gap-3 p-5">
              <Skeleton className="size-10 shrink-0" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            </Card>
          ))}
        </div>
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
          <Card data-testid="admin-company-team-skeleton" className="grid min-w-0 gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-64 max-w-full" />
              </div>
              <Skeleton className="h-6 w-14 shrink-0" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="grid gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </div>
          </Card>
          <Card data-testid="admin-company-team-skeleton" className="grid min-w-0 gap-3 p-5">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex min-w-0 items-start gap-3 border-t pt-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="grid min-w-0 flex-1 gap-2">
                  <Skeleton className="h-4 w-32 max-w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-6 w-40 max-w-full" />
                </div>
              </div>
            ))}
          </Card>
        </div>
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
          <Card className="grid min-w-0 gap-4 p-5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-32 w-full" />
          </Card>
          <Card className="grid min-w-0 gap-3 p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
