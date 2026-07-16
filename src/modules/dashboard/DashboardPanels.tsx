import { FiActivity, FiBell, FiChevronRight, FiMapPin, FiTruck } from 'react-icons/fi';

import { Badge, Card, CardContent, CardHeader, EmptyState, IconButton } from '@/shared/ui';

import type { FleetEvent, FleetStat, Vehicle, VehicleStatus } from './types';

const statusPresentation: Record<VehicleStatus, { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' }> = {
  moving: { label: 'В движении', tone: 'success' },
  idle: { label: 'Стоит', tone: 'warning' },
  offline: { label: 'Нет связи', tone: 'neutral' },
  alarm: { label: 'Тревога', tone: 'danger' },
};

export function StatusIndicator({ status }: { status: VehicleStatus }) {
  const presentation = statusPresentation[status];
  return <Badge tone={presentation.tone}>{presentation.label}</Badge>;
}

export function FleetStatCard({ stat }: { stat: FleetStat }) {
  return (
    <Card className="min-w-0">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--color-text-secondary)]">{stat.label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{stat.value}</p>
          <Badge tone={stat.tone} className="mt-3">{stat.detail}</Badge>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]" aria-hidden="true">
          <FiActivity className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export function VehicleSummary({ vehicle }: { vehicle?: Vehicle }) {
  if (!vehicle) {
    return <EmptyState title="Транспорт не найден" description="Демонстрационный список пока пуст." />;
  }

  return (
    <article className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <FiTruck className="mt-1 size-5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{vehicle.name}</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">{vehicle.plate}</p>
          </div>
        </div>
        <StatusIndicator status={vehicle.status} />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-[var(--color-text-secondary)]">Скорость</dt><dd className="font-medium">{vehicle.speedKph} км/ч</dd></div>
        <div><dt className="text-[var(--color-text-secondary)]">Топливо</dt><dd className="font-medium">{vehicle.fuelPercent}%</dd></div>
        <div><dt className="text-[var(--color-text-secondary)]">Пробег</dt><dd className="font-medium">{vehicle.mileageKm.toLocaleString('ru-RU')} км</dd></div>
      </dl>
      <p className="text-xs text-[var(--color-text-secondary)]">Последний сигнал: {vehicle.lastSeenLabel}</p>
    </article>
  );
}

export function FleetStatusPanel({ vehicles }: { vehicles: readonly Vehicle[] }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Состояние парка</h2><p className="text-sm text-[var(--color-text-secondary)]">Демонстрационные автомобили</p></div>
        <IconButton label="Открыть список транспорта" variant="ghost"><FiChevronRight aria-hidden="true" /></IconButton>
      </CardHeader>
      <CardContent className="grid gap-3">{vehicles.length > 0 ? vehicles.map((vehicle) => <VehicleSummary key={vehicle.id} vehicle={vehicle} />) : <VehicleSummary />}</CardContent>
    </Card>
  );
}

export function FleetEvents({ events }: { events: readonly FleetEvent[] }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Последние события</h2><p className="text-sm text-[var(--color-text-secondary)]">Демонстрационная лента</p></div>
        <IconButton label="Открыть все события" variant="ghost"><FiBell aria-hidden="true" /></IconButton>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-[var(--color-border)]">
          {events.map((event) => (
            <li key={event.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
              <FiMapPin className="mt-1 size-5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
              <div className="min-w-0 flex-1"><p className="font-medium">{event.title}</p><p className="text-sm text-[var(--color-text-secondary)]">{event.vehicleName} · {event.timeLabel}</p></div>
              <Badge tone={event.tone}>{event.tone === 'danger' ? 'Важно' : event.tone === 'warning' ? 'Внимание' : 'Инфо'}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
