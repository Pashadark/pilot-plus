import { Card, CardContent, CardHeader } from '@/shared/ui';

import type { FuelSlice, MileagePoint } from './types';

const chartWidth = 520;
const chartHeight = 150;

function buildChartPoints(points: readonly MileagePoint[]) {
  const max = Math.max(...points.map((point) => point.value), 1);
  return points
    .map((point, index) => {
      const x = points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth;
      const y = chartHeight - (point.value / max) * (chartHeight - 18);
      return `${x},${y}`;
    })
    .join(' ');
}

export function MileageChart({ points }: { points: readonly MileagePoint[] }) {
  const polyline = buildChartPoints(points);

  return (
    <Card className="min-h-0 overflow-hidden">
      <CardHeader className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold">Пробег по дням</h2>
        <span className="rounded-[var(--radius-md)] border px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)]">
          7 дней
        </span>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-4">
        <div className="relative h-36" aria-label="График пробега за семь дней">
          <svg
            className="h-full w-full overflow-visible"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label="Пробег вырос с 720 до 3742 километров"
            preserveAspectRatio="none"
          >
            {[30, 68, 106, 144].map((y) => (
              <line
                key={y}
                x1="0"
                x2={chartWidth}
                y1={y}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth="1"
              />
            ))}
            <polyline
              points={polyline}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {polyline.split(' ').map((point) => {
              const [cx, cy] = point.split(',');
              return (
                <circle
                  key={point}
                  cx={cx}
                  cy={cy}
                  r="4"
                  fill="var(--color-surface)"
                  stroke="var(--color-primary)"
                  strokeWidth="3"
                />
              );
            })}
          </svg>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] text-[var(--color-text-secondary)]">
          {points.map((point) => (
            <span key={point.label}>{point.label}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const sliceColor = {
  primary: 'var(--color-primary)',
  success: 'var(--color-success)',
  danger: 'var(--color-danger)',
} as const;

export function FuelChart({ slices }: { slices: readonly FuelSlice[] }) {
  const slicesWithOffset = slices.map((slice, index) => ({
    slice,
    offset: -slices.slice(0, index).reduce((sum, item) => sum + item.percent, 0),
  }));

  return (
    <Card className="min-h-0 overflow-hidden">
      <CardHeader className="px-4 py-3">
        <h2 className="text-sm font-semibold">Расход топлива</h2>
      </CardHeader>
      <CardContent className="grid grid-cols-[7rem_1fr] items-center gap-3 px-4 py-5">
        <div className="relative mx-auto size-28">
          <svg viewBox="0 0 120 120" role="img" aria-label="Расход топлива 128 литров">
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke="var(--color-elevated)"
              strokeWidth="14"
            />
            {slicesWithOffset.map(({ slice, offset }) => {
              const dash = `${slice.percent} ${100 - slice.percent}`;
              return (
                <circle
                  key={slice.label}
                  cx="60"
                  cy="60"
                  r="45"
                  pathLength="100"
                  fill="none"
                  stroke={sliceColor[slice.tone]}
                  strokeWidth="14"
                  strokeDasharray={dash}
                  strokeDashoffset={offset}
                  transform="rotate(-90 60 60)"
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
            <strong className="text-xl leading-none">128 л</strong>
            <span className="mt-1 text-xs font-semibold text-[var(--color-success)]">+8,4%</span>
          </div>
        </div>
        <dl className="grid gap-3 text-xs">
          {slices.map((slice) => (
            <div key={slice.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
              <dt className="flex min-w-0 items-center gap-2 text-[var(--color-text-secondary)]">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: sliceColor[slice.tone] }}
                  aria-hidden="true"
                />
                <span className="truncate">{slice.label}</span>
              </dt>
              <dd className="font-semibold">{slice.value} л</dd>
              <dd className="font-semibold" style={{ color: sliceColor[slice.tone] }}>
                {slice.percent}%
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
