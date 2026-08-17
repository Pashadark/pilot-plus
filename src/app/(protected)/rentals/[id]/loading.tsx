import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Skeleton } from '@/shared/ui';

function SkeletonCard({ className = 'h-28' }: { className?: string }) {
  return <Skeleton className={className} data-testid="rental-detail-skeleton-card" />;
}

export default function Loading() {
  return (
    <AppShell
      breadcrumbs={[
        { label: 'Pilot+', href: '/' },
        { label: 'Аренда', href: '/rentals' },
        { label: 'Загрузка' },
      ]}
    >
      <main className="grid min-w-0 gap-5 p-4 sm:p-6" aria-label="Загрузка договора аренды">
        <SkeletonCard className="h-32" />
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <SkeletonCard className="h-72" />
          <SkeletonCard className="h-72" />
        </div>
        <SkeletonCard className="h-44" />
      </main>
    </AppShell>
  );
}
