import { Fragment } from 'react';
import { FiArrowRight, FiCheck } from 'react-icons/fi';

const steps = [
  { full: 'Клиент', compact: 'Клиент' },
  { full: 'Автомобиль', compact: 'Авто' },
  { full: 'Даты и цена', compact: 'Даты' },
  { full: 'Договор и чек', compact: 'Договор' },
] as const;

export function BookingProgress({ currentStep }: { currentStep: number }) {
  return (
    <ol
      aria-label="Шаги бронирования"
      className="grid grid-cols-[auto_minmax(12px,1fr)_auto_minmax(12px,1fr)_auto_minmax(12px,1fr)_auto] items-start rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-3 sm:px-4"
    >
      {steps.map((item, index) => {
        const state = index < currentStep ? 'complete' : index === currentStep ? 'current' : 'upcoming';
        return (
          <Fragment key={item.full}>
            <li
              data-testid="booking-step"
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
              className={`grid min-w-0 justify-items-center gap-1.5 text-center text-[10px] font-semibold sm:text-xs ${
                state === 'complete'
                  ? 'text-[var(--color-success)]'
                  : state === 'current'
                    ? 'text-[var(--color-primary)]'
                    : 'text-[var(--color-text-secondary)]'
              }`}
            >
              <span
                data-testid="booking-step-marker"
                className={`grid size-9 place-items-center rounded-full border text-xs font-bold sm:size-10 sm:text-sm ${
                  state === 'complete'
                    ? 'border-[var(--color-success)] bg-[var(--color-success-soft)]'
                    : state === 'current'
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-text-inverse)]'
                      : 'border-[var(--color-border-strong)] bg-[var(--color-surface)]'
                }`}
              >
                {state === 'complete' ? <FiCheck aria-hidden /> : index + 1}
              </span>
              <span className="whitespace-nowrap sm:hidden">{item.compact}</span>
              <span className="hidden whitespace-nowrap sm:inline">{item.full}</span>
            </li>
            {index < steps.length - 1 ? (
              <li
                data-testid="booking-step-arrow"
                aria-hidden
                className="mt-2.5 flex min-w-0 items-center px-1 text-[var(--color-text-tertiary)] sm:mt-3"
              >
                <span className="h-px min-w-0 flex-1 bg-[var(--color-border-strong)]" />
                <FiArrowRight className="-ml-px shrink-0 text-sm" />
              </li>
            ) : null}
          </Fragment>
        );
      })}
    </ol>
  );
}
