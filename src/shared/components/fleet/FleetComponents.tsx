import { FiMapPin } from 'react-icons/fi';

import { Badge } from '@/shared/ui';

export type FleetSemanticStatus = 'moving' | 'idle' | 'offline' | 'alarm';
export type ConnectionState = 'online' | 'offline';
export type EventTone = 'info' | 'warning' | 'danger';

const statusLabels: Record<FleetSemanticStatus, string> = {
  moving: 'в движении',
  idle: 'стоит',
  offline: 'нет связи',
  alarm: 'тревога',
};

const markerColors: Record<FleetSemanticStatus, string> = {
  moving: 'var(--color-primary)',
  idle: 'var(--color-warning)',
  offline: 'var(--color-text-secondary)',
  alarm: 'var(--color-danger)',
};

export function VehicleMarker({
  name,
  plate,
  speedKph,
  status,
  expanded = false,
}: {
  name: string;
  plate: string;
  speedKph: number;
  status: FleetSemanticStatus;
  expanded?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={`${name}, ${plate}, ${statusLabels[status]}`}
      data-state={status}
      className="grid min-h-11 min-w-11 place-items-center rounded-[var(--radius-md)] border-2 border-[var(--color-surface)] px-2 text-xs font-semibold text-[var(--color-text-inverse)] shadow-[var(--shadow-card)]"
      style={{ backgroundColor: markerColors[status] }}
    >
      {expanded ? plate : speedKph}
    </span>
  );
}

export function SpeedIndicator({
  speedKph,
  state,
}: {
  speedKph: number;
  state: FleetSemanticStatus;
}) {
  return (
    <span data-state={state} className="font-medium tabular-nums">
      Скорость {speedKph} км/ч
    </span>
  );
}

export function ConnectionStatus({
  state,
  lastSeenLabel,
}: {
  state: ConnectionState;
  lastSeenLabel: string;
}) {
  return (
    <span data-state={state} className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${state === 'online' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-secondary)]'}`}
      />
      {state === 'online' ? 'На связи' : 'Нет связи'} · {lastSeenLabel}
    </span>
  );
}

export function EventItem({
  title,
  vehicleName,
  timeLabel,
  tone,
}: {
  title: string;
  vehicleName: string;
  timeLabel: string;
  tone: EventTone;
}) {
  return (
    <li
      aria-label={`${title}, ${vehicleName}`}
      data-tone={tone}
      className="flex min-h-11 gap-3 py-3 first:pt-0 last:pb-0"
    >
      <FiMapPin className="mt-1 size-5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {vehicleName} · {timeLabel}
        </p>
      </div>
      <Badge tone={tone}>
        {tone === 'danger' ? 'Важно' : tone === 'warning' ? 'Внимание' : 'Инфо'}
      </Badge>
    </li>
  );
}
