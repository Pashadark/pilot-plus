import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Card, Skeleton } from '@/shared/ui';

export default function NewRentalLoading() {
  return (
    <AppShell
      breadcrumbs={[
        { label: 'СУПА ПРО', href: '/' },
        { label: 'Клиенты', href: '/clients' },
        { label: 'Новый договор' },
      ]}
    >
      <main
        aria-label="Загрузка нового договора"
        className="mx-auto grid w-full max-w-5xl gap-5 p-4 sm:p-6"
      >
        <Skeleton className="h-11 w-44 motion-reduce:animate-none" />
        <Card className="grid min-h-[38rem] gap-5 p-5">
          <Skeleton className="h-9 w-2/3 motion-reduce:animate-none" />
          <Skeleton className="h-20 w-full motion-reduce:animate-none" />
          <Skeleton className="h-56 w-full motion-reduce:animate-none" />
          <div className="flex justify-between">
            <Skeleton className="h-11 w-28 motion-reduce:animate-none" />
            <Skeleton className="h-11 w-44 motion-reduce:animate-none" />
          </div>
        </Card>
      </main>
    </AppShell>
  );
}
