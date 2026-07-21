import type { HTMLAttributes } from 'react';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--color-elevated)] text-[var(--color-text-secondary)]',
  primary: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  info: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'min-h-6 px-2 py-0.5 text-xs',
  md: 'min-h-7 px-2.5 py-1 text-xs',
  lg: 'min-h-9 px-3 py-1.5 text-sm',
};

export function Badge({ tone = 'neutral', size = 'sm', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizes[size]} ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
