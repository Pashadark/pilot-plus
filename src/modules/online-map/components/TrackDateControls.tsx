import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

import { FilterChip } from '@/shared/ui';
import type { TrackPeriodMode } from '../track-types';

export interface TrackDateControlsProps {
  dates: readonly string[];
  value: string;
  period: TrackPeriodMode;
  onChange: (date: string) => void;
  onPeriodChange: (period: TrackPeriodMode) => void;
}

export function TrackDateControls({ dates, value, onChange, onPeriodChange }: TrackDateControlsProps) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const recent = Array.from({ length: 7 }, (_, index) => addDays(today, -index));
  const choices = [...new Set([...recent, ...dates, value].filter(Boolean))].sort().reverse();
  const selectDate = (date: string) => {
    if (!date) return;
    onPeriodChange('day');
    onChange(date);
  };

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <button type="button" aria-label="Предыдущий день" onClick={() => selectDate(addDays(value || today, -1))}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
          <FiChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <div role="group" aria-label="Даты маршрутов" className="scrollbar-hidden flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
          {choices.map((date) => (
            <FilterChip key={date} selected={value === date} onClick={() => selectDate(date)}
              aria-label={formatFullDate(date)} className="shrink-0">
              <span className="grid leading-tight">
                {date === today ? <span className="text-[10px] font-semibold uppercase">Сегодня</span> : null}
                <span>{formatCompactDate(date)}</span>
              </span>
            </FilterChip>
          ))}
        </div>
        <button type="button" aria-label="Следующий день" disabled={!value || value >= today}
          onClick={() => selectDate(addDays(value, 1))}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-35">
          <FiChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      <label className="grid gap-1 text-sm font-medium text-[var(--color-text)]">
        Выбрать любую дату
        <input type="date" aria-label="Выбрать любую дату" value={value}
          onChange={(event) => selectDate(event.currentTarget.value)}
          className="min-h-11 min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]" />
      </label>
    </div>
  );
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function formatFullDate(date: string): string {
  return date.split('-').reverse().join('.');
}

function formatCompactDate(date: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`))
    .replace('.', '');
}
