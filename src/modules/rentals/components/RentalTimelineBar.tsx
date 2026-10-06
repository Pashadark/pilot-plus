const urgencyClasses = {
  overdue: 'bg-[var(--color-danger)]',
  today: 'bg-[var(--color-warning)]',
  soon: 'bg-amber-400',
  normal: 'bg-[var(--color-primary)]',
  closed: 'bg-slate-400',
} as const;

function shortDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function RentalTimelineBar({
  startsAt,
  endsAt,
  progressPercent,
  urgency,
  remainingLabel,
}: {
  startsAt: string;
  endsAt: string;
  progressPercent: number;
  urgency: keyof typeof urgencyClasses;
  remainingLabel: string;
}) {
  return (
    <div className="grid min-w-0 gap-1.5" data-testid="rental-timeline">
      <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-[var(--color-text-secondary)]">
        <span>{shortDate(startsAt)}</span>
        <span className="text-right">{shortDate(endsAt)}</span>
      </div>
      <div
        role="progressbar"
        aria-label={`Срок аренды: ${remainingLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        className="h-2 overflow-hidden rounded-full bg-[var(--color-elevated)]"
      >
        <span
          className={`block h-full rounded-full ${urgencyClasses[urgency]}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p
        className={`text-xs font-semibold ${urgency === 'overdue' ? 'text-[var(--color-danger)]' : urgency === 'today' || urgency === 'soon' ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-secondary)]'}`}
      >
        {remainingLabel}
      </p>
    </div>
  );
}
