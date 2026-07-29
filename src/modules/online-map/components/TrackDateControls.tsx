import { FilterChip, Select } from '@/shared/ui';

export interface TrackDateControlsProps {
  dates: readonly string[];
  value: string;
  onChange: (date: string) => void;
}

const quickPeriods = ['Сегодня', 'Вчера', '7 дней'] as const;

function formatDate(date: string): string {
  return date.split('-').reverse().join('.');
}

export function TrackDateControls({ dates, value, onChange }: TrackDateControlsProps) {
  const applyQuickPeriod = (period: (typeof quickPeriods)[number]) => {
    if (period === 'Сегодня' && dates[0]) onChange(dates[0]);
    if (period === 'Вчера' && dates[1]) onChange(dates[1]);
  };

  return (
    <div className="grid gap-3">
      <Select
        label="Дата маршрута"
        aria-label="Дата маршрута"
        value={value}
        disabled={dates.length === 0}
        onChange={(event) => onChange(event.currentTarget.value)}
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
            (period === 'Сегодня' && value === dates[0]) ||
            (period === 'Вчера' && value === dates[1]);

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
