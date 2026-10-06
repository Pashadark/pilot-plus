import { Badge } from '@/shared/ui';

import type { VehicleTrackEventView } from '../track-types';

export function TrackEventPopup({ event, count }: { event: VehicleTrackEventView; count: number }) {
  if (event.type === 'fine' && event.fine) {
    const fine = event.fine;
    return (
      <article aria-label={`Событие: ${event.title}`} className="min-w-64 space-y-2 p-1">
        <div className="flex items-center justify-between gap-3">
          <strong>Штраф · {formatMoney(fine.amountMinor)}</strong>
          <Badge>{fine.status === 'PAID' ? 'Оплачен' : 'К оплате'}</Badge>
        </div>
        <p>{formatFineDate(fine.offenseAt)}</p>
        <p>{fine.address ?? event.address}</p>
        <p>{fine.description ?? 'Нарушение ПДД'}</p>
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
    <article aria-label={`Событие: ${event.title}`} className="min-w-56 space-y-2 p-1">
      <div className="flex items-center justify-between gap-3">
        <strong>{event.title}</strong>
        {count > 1 ? <Badge>{count} события</Badge> : null}
      </div>
      <p>
        {event.timestamp} · {event.speedKph} км/ч
      </p>
      <p>{event.address}</p>
      <p>{event.description}</p>
    </article>
  );
}

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
