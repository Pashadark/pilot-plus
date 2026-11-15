'use client';

import { useRef } from 'react';

import { FiCheck } from 'react-icons/fi';

import { constructorSections, sectionStatus } from '../domain/flow';
import type { RentalConstructorSectionId, RentalConstructorState } from '../domain/types';

export function ConstructorSections({
  active,
  state,
  onSelect,
}: {
  active: RentalConstructorSectionId;
  state: RentalConstructorState;
  onSelect(id: RentalConstructorSectionId): void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const complete = constructorSections.filter(
    (section) => sectionStatus(state, section.id) === 'complete',
  ).length;

  return (
    <nav
      aria-label="Разделы нового договора"
      className="grid content-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]"
    >
      <p className="px-2 pt-1 text-xs font-bold tracking-[0.14em] text-[var(--color-text-secondary)] uppercase">
        Разделы
      </p>
      <ol ref={listRef} className="grid gap-2">
        {constructorSections.map((section, index) => {
          const current = active === section.id;
          const status = sectionStatus(state, section.id);
          return (
            <li key={section.id}>
              <button
                type="button"
                data-testid="constructor-section"
                aria-current={current ? 'step' : undefined}
                onClick={() => onSelect(section.id)}
                onKeyDown={(event) => {
                  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const buttons = Array.from(
                    listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
                  );
                  const targetIndex =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? buttons.length - 1
                        : event.key === 'ArrowDown'
                          ? Math.min(index + 1, buttons.length - 1)
                          : Math.max(index - 1, 0);
                  buttons[targetIndex]?.focus();
                }}
                className={`flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-md)] border px-3 text-left text-sm font-semibold transition-colors ${
                  current
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                    : 'border-[var(--color-border)] bg-[var(--color-elevated)] hover:border-[var(--color-border-strong)]'
                }`}
              >
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-xs ${
                    current
                      ? 'bg-white/15'
                      : status === 'complete'
                        ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                        : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  {status === 'complete' && !current ? <FiCheck aria-hidden /> : index + 1}
                </span>
                <span>{section.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 grid gap-2 px-2 pb-1 text-xs text-[var(--color-text-secondary)]">
        <span>{complete} из 7 разделов заполнено</span>
        <span className="h-1.5 overflow-hidden rounded-full bg-[var(--color-elevated)]">
          <span
            className="block h-full rounded-full bg-[var(--color-primary)]"
            style={{ width: `${(complete / constructorSections.length) * 100}%` }}
          />
        </span>
      </div>
    </nav>
  );
}

