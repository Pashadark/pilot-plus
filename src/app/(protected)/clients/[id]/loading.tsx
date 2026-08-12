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
        <Skeleton className="h-11 w-36 motion-reduce:animate-none" />
        <Card className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 p-5">
          <Skeleton className="size-[5.5rem] motion-reduce:animate-none" />
          <div className="grid gap-3">
            <Skeleton className="h-8 w-2/3 motion-reduce:animate-none" />
            <Skeleton className="h-5 w-1/2 motion-reduce:animate-none" />
          </div>
        </Card>
        <div className="grid gap-5 xl:grid-cols-2">
          <Skeleton className="h-72 motion-reduce:animate-none" />
          <Skeleton className="h-72 motion-reduce:animate-none" />
        </div>
        <Card data-testid="client-documents-skeleton" className="overflow-hidden">
          <div className="grid min-h-24 gap-2 border-b p-5">
            <Skeleton className="h-6 w-48 motion-reduce:animate-none" />
            <Skeleton className="h-4 w-full max-w-xl motion-reduce:animate-none" />
          </div>
          <div className="grid min-h-[27rem] gap-4 p-5 xl:grid-cols-2">
            {[0, 1].map((index) => (
              <div
                key={index}
                className="grid content-start gap-4 rounded-[var(--radius-lg)] bg-[var(--color-elevated)] p-4"
              >
                <Skeleton className="h-6 w-44 motion-reduce:animate-none" />
                <Skeleton className="h-12 w-full motion-reduce:animate-none" />
                <Skeleton className="h-40 w-full motion-reduce:animate-none" />
                <Skeleton className="h-11 w-44 motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </Card>
      </main>
    </AppShell>
  );
}
