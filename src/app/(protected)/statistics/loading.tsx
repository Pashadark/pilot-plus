import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Skeleton } from '@/shared/ui/Feedback';
import styles from '@/modules/statistics/statistics.module.css';
export default function StatisticsLoading() {
  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Статистика' }]}>
      <main className={styles.page} aria-label="Загрузка статистики">
        <Skeleton className="h-24" />
        <Skeleton className="h-80" />
        <div className={styles.metrics}>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
        <div className={styles.charts}>
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </main>
    </AppShell>
  );
}
