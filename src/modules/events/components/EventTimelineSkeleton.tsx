import { Card, Skeleton } from '@/shared/ui';

export function EventTimelineSkeleton() {
  return (
    <main aria-label="Загрузка истории событий" className="grid min-w-0 gap-5 p-4 sm:p-6">
      <Skeleton className="h-24" />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="h-24 p-4">
            <Skeleton className="h-14" />
          </Card>
        ))}
      </section>
      <Card className="h-44 p-4">
        <Skeleton className="h-full" />
      </Card>
      <section className="grid gap-3">
        {Array.from({ length: 8 }, (_, index) => (
          <Card key={index} className="h-44 p-4">
            <Skeleton className="h-full" />
          </Card>
        ))}
      </section>
    </main>
  );
}
