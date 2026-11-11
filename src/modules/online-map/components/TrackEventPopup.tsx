import { Badge } from '@/shared/ui';
import { LuMapPin } from 'react-icons/lu';

import type { VehicleTrackEventView } from '../track-types';

export function TrackEventPopup({ event, count }: { event: VehicleTrackEventView; count: number }) {
  if (event.type === 'fine' && event.fine) {
    const fine = event.fine;
    return (
      <article aria-label={`Событие: ${event.title}`} className={`${popupClassName} min-w-64`}>
        <header className="flex items-center justify-between gap-3">
          <strong className="text-[13px] text-[var(--color-text)]">Штраф</strong>
          <span className="shrink-0 text-[11px] text-[var(--color-text-secondary)] tabular-nums">
            {event.timestamp}
          </span>
        </header>
        <div className="flex items-center gap-2" data-track-event-metric>
          <strong className="text-sm text-[var(--color-text)] tabular-nums">
            {formatMoney(fine.amountMinor)}
          </strong>
          <Badge>{fine.status === 'PAID' ? 'Оплачен' : 'К оплате'}</Badge>
        </div>
        <p className="flex items-start gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
          <LuMapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>{fine.address ?? event.address}</span>
        </p>
        <p className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">
          {fine.description ?? 'Нарушение ПДД'}
        </p>
        {fine.locationSource === 'time-inferred' ? (
          <p className="text-xs text-[var(--color-warning)]">Место определено по времени</p>
        ) : null}
        {fine.clientName ? <p className="text-[10px]">Клиент: {fine.clientName}</p> : null}
        {fine.contractNumber ? <p className="text-[10px]">Договор: {fine.contractNumber}</p> : null}
        <a
          href={`/fines?query=${encodeURIComponent(fine.decreeNumber)}`}
          className="inline-flex min-h-8 items-center text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
        >
          Открыть штраф
        </a>
      </article>
    );
  }

  const metric = getEventMetric(event);
  const detail = event.description === metric ? null : event.description;

  return (
    <article aria-label={`Событие: ${event.title}`} className={`${popupClassName} min-w-64`}>
      <header className="flex items-center justify-between gap-3">
        <strong className="text-[13px] text-[var(--color-text)]">
          {eventTypeLabels[event.type]}
        </strong>
        <span className="shrink-0 text-[11px] text-[var(--color-text-secondary)] tabular-nums">
          {event.timestamp}
        </span>
      </header>
      <div className="flex items-center gap-2" data-track-event-metric>
        <strong className="text-sm text-[var(--color-text)] tabular-nums">{metric}</strong>
        {count > 1 ? <Badge>{count} события</Badge> : null}
      </div>
      <p className="flex items-start gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
        <LuMapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>{event.address}</span>
      </p>
      {detail ? (
        <p className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">{detail}</p>
      ) : null}
    </article>
  );
}

const popupClassName =
  'max-w-72 space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-3 text-xs shadow-[var(--shadow-floating)]';

const eventTypeLabels: Record<VehicleTrackEventView['type'], string> = {
  stop: 'Остановка',
  refuel: 'Заправка',
  speeding: 'Превышение',
  fine: 'Штраф',
  'connection-loss': 'Потеря связи',
  'geofence-enter': 'Въезд в геозону',
  'geofence-exit': 'Выезд из геозоны',
  'harsh-acceleration': 'Резкий разгон',
  'harsh-braking': 'Резкое торможение',
};

function getEventMetric(event: VehicleTrackEventView): string {
  if (event.type === 'connection-loss') return 'Нет сигнала';
  if (event.type === 'speeding') return `${event.speedKph} км/ч`;
  if (event.type === 'harsh-acceleration' || event.type === 'harsh-braking') {
    const speeds = event.metricLabel?.replace(/\s*→\s*/u, ' → ');
    return speeds ? `${speeds} км/ч` : `${event.speedKph} км/ч`;
  }
  return event.description;
}

function formatMoney(amountMinor: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(amountMinor / 100))} ₽`;
}
