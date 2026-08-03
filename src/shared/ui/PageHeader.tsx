import type { ReactNode } from 'react';

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
}

export function PageHeader({ eyebrow, title, description, actions, titleId }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow != null && (
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[var(--color-text-secondary)]">
            {eyebrow}
          </p>
        )}
        <h1 id={titleId} className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description != null && (
          <div className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base">
            {description}
          </div>
        )}
      </div>
      {actions != null && <div className="flex min-h-11 items-center gap-2">{actions}</div>}
    </header>
  );
}
