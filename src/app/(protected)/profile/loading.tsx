import { Card, Skeleton } from '@/shared/ui';

function FormSkeleton() {
  return (
    <Card className="grid gap-4 p-5">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-40" />
    </Card>
  );
}

export default function ProfileLoading() {
  return (
    <section aria-label="Загрузка профиля" className="grid min-w-0 gap-5 p-4 sm:p-6">
      <div className="grid gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-[32rem] max-w-full" />
      </div>
      <Card className="flex items-center gap-4 p-4 sm:p-5">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="grid min-w-0 flex-1 gap-2">
          <Skeleton className="h-5 w-40 max-w-full" />
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-6 w-28" />
        </div>
      </Card>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <FormSkeleton />
        <FormSkeleton />
      </div>
    </section>
  );
}
