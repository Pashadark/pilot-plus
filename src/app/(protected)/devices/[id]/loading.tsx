import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Card, Skeleton } from '@/shared/ui';

export default function DeviceLoading() {
  return (
    <AppShell
      breadcrumbs={[
        { label: 'Pilot+', href: '/' },
        { label: 'Устройства', href: '/devices' },
        { label: 'Загрузка' },
      ]}
    >
      <main className="grid gap-5 p-4 sm:p-6" aria-label="Загрузка устройства">
        <Skeleton className="h-11 w-36" />
        <Card className="p-5">
          <Skeleton className="h-24" />
        </Card>
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="grid gap-5">
            <Skeleton className="h-72" />
            <Skeleton className="h-64" />
          </div>
          <div className="grid gap-5">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
