import { normalizeFuelLevel } from '../fuel-level';
import { meterColor } from '@/modules/maintenance/service-meter';

export function FuelLevelBar({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-[var(--color-text-secondary)]">Нет данных</span>;
  }

  const safe = normalizeFuelLevel(value);

  return (
    <div
      role="progressbar"
      aria-label="Уровень топлива"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
      className="min-w-20"
    >
      <span className="text-sm tabular-nums">{safe}%</span>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
        <div
          data-testid="fuel-level-fill"
          aria-hidden="true"
          className="h-full rounded-full transition-[width,background-color] duration-500 motion-reduce:transition-none"
          style={{ width: `${safe}%`, backgroundColor: meterColor(safe) }}
        />
      </div>
    </div>
  );
}
