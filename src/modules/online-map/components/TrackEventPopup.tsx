import { Badge } from '@/shared/ui';

import type { VehicleTrackEventView } from '../track-types';

export function TrackEventPopup({ event, count }: { event: VehicleTrackEventView; count: number }) {
  if (event.type === 'fine' && event.fine) {
    const fine = event.fine;
    return (
      <article aria-label={`Событие: ${event.title}`} className={`${popupClassName} min-w-64`}>
        <div className="flex items-center justify-between gap-3">
          <strong className="text-[var(--color-text)]">
            Штраф · {formatMoney(fine.amountMinor)}
          </strong>
          <Badge>{fine.status === 'PAID' ? 'Оплачен' : 'К оплате'}</Badge>
        </div>
        <p className="font-semibold text-[var(--color-text)] tabular-nums">
          {formatFineDate(fine.offenseAt)}
        </p>
        <p className="text-[var(--color-text-secondary)]">{fine.address ?? event.address}</p>
        <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
          {fine.description ?? 'Нарушение ПДД'}
        </p>
        {fine.locationSource === 'time-inferred' ? (
          <p className="text-xs text-[var(--color-warning)]">Место определено по времени</p>
        ) : null}
        {fine.clientName ? <p>Клиент: {fine.clientName}</p> : null}
        {fine.contractNumber ? <p>Договор: {fine.contractNumber}</p> : null}
        <a
          href={`/fines?query=${encodeURIComponent(fine.decreeNumber)}`}
          className="inline-flex min-h-11 items-center font-semibold text-[var(--color-primary)] hover:underline"
        >
          Открыть штраф
        </a>
      </article>
    );
  }

  return (
    <article aria-label={`Событие: ${event.title}`} className={`${popupClassName} min-w-56`}>
      <div className="flex items-center justify-between gap-3">
        <strong className="text-[var(--color-text)]">{event.title}</strong>
        {count > 1 ? <Badge>{count} события</Badge> : null}
      </div>
      <p className="font-semibold text-[var(--color-text)] tabular-nums">
        {event.timestamp} · {event.speedKph} км/ч
      </p>
      <p className="text-[var(--color-text-secondary)]">{event.address}</p>
      <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {event.description}
      </p>
    </article>
  );
}

const popupClassName =
  'max-w-72 space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm shadow-[var(--shadow-card)]';

function formatMoney(amountMinor: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(amountMinor / 100))} ₽`;
}

function formatFineDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
