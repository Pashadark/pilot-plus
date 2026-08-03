'use client';

import { useState, type HTMLAttributes, type ReactNode, type TableHTMLAttributes } from 'react';
const avatarSizes = {
  xs: 'size-7 text-xs',
  sm: 'size-9 text-sm',
  md: 'size-11',
  lg: 'size-14 text-lg',
};

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      role="img"
      aria-label={name}
      onErrorCapture={() => setHasImageError(true)}
      className={`grid place-items-center overflow-hidden rounded-full bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)] ${avatarSizes[size]} ${className ?? ''}`}
    >
      {src && !hasImageError ? (
        <img className="size-full object-cover" src={src} alt="" onError={() => setHasImageError(true)} />
      ) : (
        initials
      )}
    </span>
  );
}
export function ListItem({
  leading,
  title,
  description,
  trailing,
  ...props
}: HTMLAttributes<HTMLLIElement> & {
  leading?: ReactNode;
  title: string;
  description?: string;
  trailing?: ReactNode;
}) {
  return (
    <li {...props} className={`flex min-h-11 items-center gap-3 py-2 ${props.className ?? ''}`}>
      {leading}
      <span className="min-w-0 flex-1">
        <strong className="block">{title}</strong>
        {description && (
          <span className="block text-sm text-[var(--color-text-secondary)]">{description}</span>
        )}
      </span>
      {trailing}
    </li>
  );
}
export function Table(props: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table {...props} className={`w-full border-collapse text-left ${props.className ?? ''}`} />
    </div>
  );
}
export const TableHeader = (props: HTMLAttributes<HTMLTableSectionElement>) => <thead {...props} />;
export const TableBody = (props: HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props} />;
export const TableRow = (props: HTMLAttributes<HTMLTableRowElement>) => (
  <tr {...props} className={`border-b border-[var(--color-border)] ${props.className ?? ''}`} />
);
export const TableHead = (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th {...props} className={`p-3 font-semibold ${props.className ?? ''}`} />
);
export const TableCell = (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td {...props} className={`p-3 ${props.className ?? ''}`} />
);
export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[var(--radius-panel)] border bg-[var(--color-surface)] p-4">
      <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
      <strong className="mt-1 block text-2xl">{value}</strong>
    </article>
  );
}
export function StatusIndicator({
  label,
  tone = 'neutral',
}: {
  label?: string;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${tone === 'primary' ? 'bg-[var(--color-primary)]' : tone === 'success' ? 'bg-[var(--color-success)]' : tone === 'warning' ? 'bg-[var(--color-warning)]' : tone === 'danger' ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-text-secondary)]'}`}
      />
      {label}
    </span>
  );
}
export function VehiclePlate({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border-2 border-[var(--color-border-strong)] px-3 font-mono font-bold">
      {children}
    </span>
  );
}
