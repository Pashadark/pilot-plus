import { FiAlertTriangle, FiMapPin } from 'react-icons/fi';

import type { OnlineMapTrackFine } from '../track-types';

export function TrackFineList({ fines }: { fines: readonly OnlineMapTrackFine[] }) {
  return (
    <section aria-labelledby="track-fines-title" className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 id="track-fines-title" className="font-semibold">
          Штрафы на маршруте
        </h3>
        <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-bold text-violet-700">
          {fines.length}
        </span>
      </div>
      <div className="grid gap-2">
        {fines.map((fine) => (
          <a
            key={fine.id}
            href={`/fines?query=${encodeURIComponent(fine.decreeNumber)}`}
            className="grid min-h-11 grid-cols-[auto_1fr_auto] items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 transition-colors hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            <span className="grid size-8 place-items-center rounded-full bg-violet-500/10 text-violet-700">
              <FiAlertTriangle aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <strong className="block text-sm">{formatMoney(fine.amountMinor)}</strong>
              <span className="block truncate text-xs text-[var(--color-text-secondary)]">
                {fine.address ?? fine.description ?? `Постановление ${fine.decreeNumber}`}
              </span>
              <span className="mt-1 flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)]">
                <FiMapPin aria-hidden="true" />
                {locationLabel(fine)}
              </span>
            </span>
            <time className="text-xs tabular-nums text-[var(--color-text-secondary)]">
              {formatDate(fine.offenseAt)}
            </time>
          </a>
        ))}
      </div>
    </section>
  );
}

function locationLabel(fine: OnlineMapTrackFine): string {
  if (fine.locationSource === 'exact') return 'Точное место штрафа';
  if (fine.locationSource === 'time-inferred') return 'На маршруте по времени';
  return 'Координаты не найдены';
}

function formatMoney(amountMinor: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(amountMinor / 100))} ₽`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
