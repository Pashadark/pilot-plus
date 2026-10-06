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
      <div className="grid grid-cols-5 gap-1 text-center text-[10px] font-semibold tabular-nums text-[var(--color-text-secondary)]">
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
      <p className="mt-2 text-[10px] text-[var(--color-text-secondary)]">
        Красный участок означает высокую зафиксированную скорость, а не подтверждённый штраф.
      </p>
    </section>
  );
}
