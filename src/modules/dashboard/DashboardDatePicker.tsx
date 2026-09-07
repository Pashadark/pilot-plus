'use client';

import { useState } from 'react';
import { FiCalendar, FiX } from 'react-icons/fi';

type SelectionMode = 'day' | 'range';

export function DashboardDatePicker({
  selectionLabel,
  isCustom,
}: {
  selectionLabel: string;
  isCustom: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<SelectionMode>('day');

  return (
    <div className="relative flex shrink-0 items-center gap-2">
      <button
        type="button"
        aria-label="Выбрать дату или период"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
        className={`inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${isCustom ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)]'}`}
      >
        <FiCalendar aria-hidden="true" className="size-4" />
      </button>

      {isCustom ? (
        <span className="max-w-52 truncate text-sm font-semibold text-[var(--color-primary)]">
          {selectionLabel}
        </span>
      ) : null}

      {isOpen ? (
        <section
          role="dialog"
          aria-label="Выбор даты командного центра"
          className="absolute top-[calc(100%+0.5rem)] left-0 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-[var(--radius-panel)] border bg-[var(--color-surface)] p-4 shadow-[var(--shadow-floating)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Показать рабочий день</h2>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Выберите одну дату или нужный период
              </p>
            </div>
            <button
              type="button"
              aria-label="Закрыть календарь"
              onClick={() => setIsOpen(false)}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
            >
              <FiX aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 rounded-[var(--radius-sm)] bg-[var(--color-elevated)] p-1">
            <button
              type="button"
              onClick={() => setMode('day')}
              aria-pressed={mode === 'day'}
              className={`min-h-10 rounded-[var(--radius-sm)] px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${mode === 'day' ? 'bg-[var(--color-surface)] shadow-sm' : ''}`}
            >
              Один день
            </button>
            <button
              type="button"
              onClick={() => setMode('range')}
              aria-pressed={mode === 'range'}
              className={`min-h-10 rounded-[var(--radius-sm)] px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${mode === 'range' ? 'bg-[var(--color-surface)] shadow-sm' : ''}`}
            >
              Период
            </button>
          </div>

          <form action="/" method="get" className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              {mode === 'range' ? 'Дата начала' : 'Дата'}
              <input
                required
                type="date"
                name="from"
                className="min-h-11 rounded-[var(--radius-sm)] border bg-[var(--color-surface)] px-3 text-base focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
              />
            </label>
            {mode === 'range' ? (
              <label className="grid gap-1.5 text-sm font-medium">
                Дата окончания
                <input
                  required
                  type="date"
                  name="to"
                  className="min-h-11 rounded-[var(--radius-sm)] border bg-[var(--color-surface)] px-3 text-base focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                />
              </label>
            ) : null}
            <button
              type="submit"
              className="mt-1 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-text-inverse)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              Показать
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
