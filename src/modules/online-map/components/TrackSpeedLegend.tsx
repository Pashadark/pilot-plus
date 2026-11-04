const SPEED_BANDS = [
  { label: '0–39', color: '#22c55e' },
  { label: '40–69', color: '#f59e0b' },
  { label: '70–99', color: '#f97316' },
  { label: '100+ км/ч', color: '#ef4444' },
  { label: '120+ км/ч', color: '#111827' },
] as const;

export function TrackSpeedLegend() {
  return (
    <section
      aria-label="Шкала скорости маршрута"
      className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]"
    >
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-[linear-gradient(90deg,#22c55e_0_20%,#f59e0b_20%_40%,#f97316_40%_60%,#ef4444_60%_80%,#7f1d1d_80%_92%,#111827_92%_100%)]" />
      <div className="grid grid-cols-5 gap-1 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] tabular-nums">
        {SPEED_BANDS.map((band) => (
          <span key={band.label} className="inline-flex items-center justify-center gap-1">
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: band.color }}
            />
            {band.label}
          </span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-3 text-[10px] font-semibold text-[var(--color-text)]">
        <span className="inline-flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#ff4d4f] bg-[#17171c]"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            >
              <path d="M4.9 18a8 8 0 1 1 14.2 0" />
              <path d="m12 14 3.5-3.5" />
              <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span>Превышение</span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex size-7 shrink-0 rotate-45 items-center justify-center rounded-[7px] border-[1.5px] border-[#ff8a1f] bg-[#17171c]"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4 -rotate-45"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.25"
            >
              <path d="m7 7 5 5-5 5" />
              <path d="m13 7 5 5-5 5" />
            </svg>
          </span>
          <span>Резкий разгон</span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-[#343438] bg-[#0067ff] text-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.25"
            >
              <path d="m6 10 6 6 6-6" />
              <path d="m6 5 6 6 6-6" />
            </svg>
          </span>
          <span>Резкое торможение</span>
        </span>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-text-secondary)]">
        Красный участок показывает высокую скорость. Красный поинт отмечает превышение, оранжевый —
        резкий разгон, синий — резкое торможение. Это GPS-события, а не подтверждённые штрафы.
      </p>
    </section>
  );
}
