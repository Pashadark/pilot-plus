import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Skeleton } from '@/shared/ui';

export default function OnlineMapLoading() {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Онлайн-карта' }]}>
      <main
        className="@container relative -m-4 h-[calc(100dvh-var(--header-height))] min-h-0 overflow-hidden bg-[var(--color-canvas)] lg:-m-5"
        aria-label="Загрузка онлайн-карты"
      >
        <Skeleton className="absolute inset-0 rounded-none bg-[var(--color-primary-soft)]" />

        <div className="absolute top-3 right-3 left-3 z-10 grid gap-2 @min-[48rem]:right-auto @min-[48rem]:left-4 @min-[48rem]:w-[min(25rem,calc(100%-23rem))]">
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

        <Skeleton className="absolute top-28 left-3 z-10 h-7 w-40 rounded-full shadow-[var(--shadow-card)] @min-[48rem]:left-4" />

        <aside
          aria-label="Загрузка панели выбранного автомобиля"
          className="absolute right-0 bottom-0 left-0 z-10 grid max-h-[42dvh] gap-4 rounded-t-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 pb-[max(4rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-floating)] @min-[48rem]:top-4 @min-[48rem]:right-4 @min-[48rem]:bottom-4 @min-[48rem]:left-auto @min-[48rem]:max-h-none @min-[48rem]:w-80 @min-[48rem]:rounded-[var(--radius-panel)] @min-[48rem]:pb-4"
        >
          <div className="flex gap-3">
            <Skeleton className="size-11 shrink-0" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
          <Skeleton className="h-11 w-full" aria-label="Загружается выбор даты" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-16 rounded-[var(--radius-md)]" />
            ))}
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-auto h-11 w-28" />
        </aside>

        <Skeleton className="absolute bottom-4 left-1/2 h-14 w-[min(34rem,calc(100%-2rem))] -translate-x-1/2" />
      </main>
    </AppShell>
  );
}
