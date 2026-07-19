import type { ReactNode } from 'react';

export type SystemStateTone = 'primary' | 'warning' | 'danger';

export interface SystemStateProps {
  code: string | number;
  tone: SystemStateTone;
  icon?: ReactNode;
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  reference?: string;
}

const toneStyles: Record<SystemStateTone, { accent: string; marker: string }> = {
  primary: {
    accent: 'border-[var(--color-primary)] text-[var(--color-primary)]',
    marker: 'bg-[var(--color-primary)]',
  },
  warning: {
    accent: 'border-[var(--color-warning)] text-[var(--color-warning)]',
    marker: 'bg-[var(--color-warning)]',
  },
  danger: {
    accent: 'border-[var(--color-danger)] text-[var(--color-danger)]',
    marker: 'bg-[var(--color-danger)]',
  },
};

export function safeErrorReference(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof error.digest === 'string'
  ) {
    const digest = error.digest.trim();
    return digest || undefined;
  }

  return undefined;
}

export function SystemState({
  code,
  tone,
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  reference,
}: SystemStateProps) {
  const style = toneStyles[tone];

  return (
    <section
      role={tone === 'danger' ? 'alert' : undefined}
      className="relative grid min-h-[22rem] place-items-center overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-card)] sm:p-10"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-1/4 h-px bg-[var(--color-border)]"
      />
      <div
        aria-hidden="true"
        className="absolute top-1/4 left-[15%] h-20 w-3/5 -translate-y-1/2 rounded-full border border-dashed border-[var(--color-border-strong)]"
      />
      <div
        aria-hidden="true"
        className={`absolute top-1/4 left-[15%] size-3 -translate-y-1/2 rounded-full ${style.marker}`}
      />
      <div
        aria-hidden="true"
        className={`absolute top-1/4 right-[25%] size-5 -translate-y-1/2 rounded-full border-4 bg-[var(--color-surface)] ${style.accent}`}
      />

      <div className="relative grid max-w-xl justify-items-center gap-4">
        <div
          className={`grid size-14 place-items-center rounded-full border bg-[var(--color-elevated)] text-2xl ${style.accent}`}
        >
          {icon ?? <span aria-hidden="true">{code}</span>}
        </div>
        <span className={`text-sm font-bold tracking-[0.2em] ${style.accent}`}>{code}</span>
        <div className="grid gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">
            {title}
          </h1>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base">
            {description}
          </p>
        </div>
        {reference ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Код обращения: {reference}</p>
        ) : null}
        {primaryAction || secondaryAction ? (
          <div className="flex flex-wrap justify-center gap-3 [&>*]:inline-flex [&>*]:min-h-11 [&>*]:min-w-11 [&>*]:items-center [&>*]:justify-center">
            {primaryAction}
            {secondaryAction}
          </div>
        ) : null}
      </div>
    </section>
  );
}
