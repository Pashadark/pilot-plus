'use client';

import Link from 'next/link';
import { useRef, type KeyboardEvent } from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}
export interface TabItem<T extends string> {
  value: T;
  label: string;
  badge?: number;
}

export function Breadcrumbs({
  items,
  'aria-label': ariaLabel = 'Хлебные крошки',
}: {
  items: readonly BreadcrumbItem[];
  'aria-label'?: string;
}) {
  return (
    <nav aria-label={ariaLabel}>
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden="true">/</span>}
              {item.href && !current ? (
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center text-[var(--color-primary)] focus-visible:outline-2"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={current ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  'aria-label': ariaLabel = 'Вкладки',
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  'aria-label'?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (index: number) => {
    const item = items[index];
    if (!item) return;
    onChange(item.value);
    refs.current[index]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    select(next);
  };
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-2 border-b">
      {items.map((item, index) => (
        <button
          key={item.value}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          tabIndex={item.value === value ? 0 : -1}
          onClick={() => select(index)}
          onKeyDown={(event) => onKeyDown(event, index)}
          className="min-h-11 min-w-11 border-b-2 border-transparent px-3 aria-selected:border-[var(--color-primary)]"
        >
          {item.label}
          {item.badge !== undefined && (
            <span aria-label={`${item.badge}`} className="ml-2">
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav aria-label="Постраничная навигация" className="flex items-center gap-2">
      <button
        type="button"
        className="min-h-11 min-w-11"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Назад
      </button>
      <span aria-live="polite">
        {page} из {totalPages}
      </span>
      <button
        type="button"
        className="min-h-11 min-w-11"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Вперёд
      </button>
    </nav>
  );
}

export function FilterChip({
  selected,
  className = '',
  ...props
}: { selected: boolean } & Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'aria-pressed'
>) {
  return (
    <button
      {...props}
      type="button"
      aria-pressed={selected}
      className={`min-h-11 rounded-full border px-4 aria-pressed:border-[var(--color-primary)] aria-pressed:bg-[var(--color-primary-soft)] ${className}`}
    />
  );
}
