import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Card, Skeleton } from '@/shared/ui';

export default function VehicleLoading() {
  return <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Автомобили', href: '/vehicles' }, { label: 'Загрузка' }]}><main className="grid gap-5 p-4 sm:p-6" aria-label="Загрузка автомобиля"><Skeleton className="h-11 w-32" /><Card className="p-5"><Skeleton className="h-36" /></Card><Skeleton className="h-72" /></main></AppShell>;
}
