import { FilterChip, Select } from '@/shared/ui';
import type { TrackPeriodMode } from '../track-types';

export interface TrackDateControlsProps {
  dates: readonly string[];
  value: string;
  period: TrackPeriodMode;
  onChange: (date: string) => void;
  onPeriodChange: (period: TrackPeriodMode) => void;
}

const quickPeriods = ['Сегодня', 'Вчера', '7 дней'] as const;

function formatDate(date: string): string {
  return date.split('-').reverse().join('.');
}

export function TrackDateControls({
  dates,
  value,
  period: activePeriod,
  onChange,
  onPeriodChange,
}: TrackDateControlsProps) {
  const applyQuickPeriod = (period: (typeof quickPeriods)[number]) => {
    if (period === 'Сегодня' && dates[0]) {
      onPeriodChange('day');
      onChange(dates[0]);
    }
    if (period === 'Вчера' && dates[1]) {
      onPeriodChange('day');
      onChange(dates[1]);
    }
    if (period === '7 дней' && dates[0]) {
      onPeriodChange('seven-days');
    }
  };

  return (
    <div className="grid gap-3">
      <Select
        label="Дата маршрута"
        aria-label="Дата маршрута"
        value={value}
        disabled={dates.length === 0}
        onChange={(event) => {
          onPeriodChange('day');
          onChange(event.currentTarget.value);
        }}
      >
        {dates.length === 0 ? (
          <option value="">Нет доступных дат</option>
        ) : (
          dates.map((date) => (
            <option key={date} value={date}>
              {formatDate(date)}
            </option>
          ))
        )}
      </Select>
      <div
        role="group"
        aria-label="Быстрый период"
        className="scrollbar-hidden flex gap-2 overflow-x-auto pb-1"
      >
        {quickPeriods.map((period) => {
          const selected =
            (activePeriod === 'day' && period === 'Сегодня' && value === dates[0]) ||
            (activePeriod === 'day' && period === 'Вчера' && value === dates[1]) ||
            (period === '7 дней' && activePeriod === 'seven-days');

          return (
            <FilterChip
              key={period}
              selected={selected}
              onClick={() => applyQuickPeriod(period)}
              className="shrink-0"
            >
              {period}
            </FilterChip>
          );
        })}
      </div>
    </div>
  );
}
