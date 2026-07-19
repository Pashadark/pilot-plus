import {
  FiActivity,
  FiChevronRight,
  FiDroplet,
  FiPause,
  FiRadio,
  FiTrendingUp,
  FiTruck,
} from 'react-icons/fi';

import { Badge, Card, CardContent, CardHeader, EmptyState, IconButton } from '@/shared/ui';
import { ConnectionStatus, EventItem, SpeedIndicator } from '@/shared/components/fleet';

import type { FleetEvent, FleetStat, Vehicle, VehicleStatus } from './types';

const statusPresentation: Record<
  VehicleStatus,
  { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' }
> = {
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
  const StatIcon = {
    vehicle: FiTruck,
    activity: FiActivity,
    pause: FiPause,
    signal: FiRadio,
    mileage: FiTrendingUp,
    fuel: FiDroplet,
  }[stat.icon];

  const toneColor = {
    primary: 'var(--color-primary)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger: 'var(--color-danger)',
  }[stat.tone];

  return (
    <Card className="min-w-0" data-testid={`fleet-stat-${stat.id}`}>
      <CardContent className="flex min-h-32 items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">{stat.label}</p>
          <p className="mt-3 text-2xl font-bold tracking-tight">{stat.value}</p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: toneColor }}>
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            {stat.detail}
          </p>
        </div>
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)]"
          style={{ color: toneColor }}
          aria-hidden="true"
        >
          <StatIcon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export function VehicleSummary({ vehicle }: { vehicle?: Vehicle }) {
  if (!vehicle) {
    return (
      <EmptyState title="Транспорт не найден" description="Демонстрационный список пока пуст." />
    );
  }

  return (
    <article className="grid gap-3 rounded-[var(--radius-panel)] border border-[var(--color-border)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <FiTruck
            className="mt-1 size-5 shrink-0 text-[var(--color-primary)]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{vehicle.name}</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">{vehicle.plate}</p>
          </div>
        </div>
        <StatusIndicator status={vehicle.status} />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-[var(--color-text-secondary)]">Скорость</dt>
          <dd>
            <SpeedIndicator speedKph={vehicle.speedKph} state={vehicle.status} />
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-secondary)]">Топливо</dt>
          <dd className="font-medium">{vehicle.fuelPercent}%</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-secondary)]">Пробег</dt>
          <dd className="font-medium">{vehicle.mileageKm.toLocaleString('ru-RU')} км</dd>
        </div>
      </dl>
      <p className="text-xs text-[var(--color-text-secondary)]">
        <ConnectionStatus
          state={vehicle.status === 'offline' ? 'offline' : 'online'}
          lastSeenLabel={vehicle.lastSeenLabel}
        />
      </p>
    </article>
  );
}

export function FleetStatusPanel({ vehicles }: { vehicles: readonly Vehicle[] }) {
  return (
    <Card data-testid="fleet-status-panel">
      <CardHeader className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Состояние парка</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">Демонстрационные автомобили</p>
        </div>
        <IconButton label="Открыть список транспорта" variant="ghost">
          <FiChevronRight aria-hidden="true" />
        </IconButton>
      </CardHeader>
      <CardContent className="grid gap-3">
        {vehicles.length > 0 ? (
          vehicles.map((vehicle) => <VehicleSummary key={vehicle.id} vehicle={vehicle} />)
        ) : (
          <VehicleSummary />
        )}
      </CardContent>
    </Card>
  );
}

export function FleetEvents({ events }: { events: readonly FleetEvent[] }) {
  return (
    <Card className="h-full overflow-hidden" data-testid="dashboard-events">
      <CardHeader className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="text-sm font-semibold">Последние события</h2>
        <button className="text-xs font-medium text-[var(--color-primary)] hover:underline">
          Смотреть все
        </button>
      </CardHeader>
      <CardContent className="px-4 py-1">
        <ul className="divide-y divide-[var(--color-border)]">
          {events.map((event) => (
            <EventItem key={event.id} {...event} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
