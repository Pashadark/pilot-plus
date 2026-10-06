import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Card, Skeleton } from '@/shared/ui';

export default function ProfileLoading() {
  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Профиль' }]}>
      <section aria-label="Загрузка профиля" className="grid min-w-0 gap-5 p-4 sm:p-6">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-5 w-[32rem] max-w-full" />
        </div>
        <Card className="flex min-h-48 items-center gap-5 overflow-hidden p-5 sm:p-7">
          <Skeleton className="size-20 shrink-0 rounded-full sm:size-24" />
          <div className="grid min-w-0 flex-1 gap-2">
            <Skeleton className="h-8 w-56 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="h-6 w-44" />
          </div>
        </Card>
        <div className="flex gap-3 border-b border-[var(--color-border)] pb-3">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="grid min-w-0 gap-5 xl:grid-cols-2">
          <Card className="grid gap-4 p-5">
            <Skeleton className="h-6 w-36" />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </Card>
          <Card className="grid gap-3 p-5">
            <Skeleton className="h-6 w-28" />
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
