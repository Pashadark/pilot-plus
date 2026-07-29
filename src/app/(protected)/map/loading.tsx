import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Skeleton } from '@/shared/ui';

export default function OnlineMapLoading() {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Онлайн-карта' }]}>
      <main
        className="relative -m-4 h-[calc(100dvh-var(--header-height))] min-h-0 overflow-hidden bg-[var(--color-canvas)] lg:-m-5"
        aria-label="Загрузка онлайн-карты"
      >
        <Skeleton className="absolute inset-0 rounded-none bg-[var(--color-primary-soft)]" />

        <div className="absolute top-3 right-3 left-3 z-10 grid gap-2 md:right-auto md:left-4 md:w-[min(25rem,calc(100%-2rem))]">
          <Skeleton className="h-11 shadow-[var(--shadow-card)]" />
          <div className="flex gap-2 py-1">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton
                key={index}
                className="h-11 w-20 shrink-0 rounded-full shadow-[var(--shadow-card)]"
              />
            ))}
          </div>
        </div>

        <Skeleton className="absolute top-28 left-3 z-10 h-7 w-40 rounded-full shadow-[var(--shadow-card)] md:left-4" />

        <aside
          aria-label="Загрузка панели выбранного автомобиля"
          className="absolute right-0 bottom-0 left-0 z-10 grid max-h-[42dvh] gap-4 rounded-t-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-floating)] md:top-4 md:right-4 md:bottom-4 md:left-auto md:max-h-none md:w-80 md:rounded-[var(--radius-panel)] md:pb-4"
        >
          <div className="flex gap-3">
            <Skeleton className="size-11 shrink-0" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-auto h-11 w-28" />
        </aside>
      </main>
    </AppShell>
  );
}
