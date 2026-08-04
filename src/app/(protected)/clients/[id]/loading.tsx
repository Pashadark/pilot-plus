import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Card, Skeleton } from '@/shared/ui';
export default function ClientLoading() {
  return (
    <AppShell
      breadcrumbs={[
        { label: 'Pilot+', href: '/' },
        { label: 'Клиенты', href: '/clients' },
      ]}
    >
      <main aria-label="Загрузка клиента" className="grid gap-5 p-4 sm:p-6">
        <Skeleton className="h-11 w-36" />
        <Card className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 p-5">
          <Skeleton className="size-[5.5rem]" />
          <div className="grid gap-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </Card>
        <div className="grid gap-5 xl:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </main>
    </AppShell>
  );
}
