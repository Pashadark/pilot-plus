import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'outline' | 'ghost' | 'danger';
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-[var(--color-primary)] text-[var(--color-text-inverse)] hover:bg-[var(--color-primary-hover)]',
  secondary:
    'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-elevated)]',
  soft: 'border-transparent bg-[var(--color-primary-soft)] text-[var(--color-primary)] hover:bg-[var(--color-elevated)]',
  outline:
    'border-[var(--color-primary)] bg-transparent text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]',
  ghost:
    'border-transparent bg-transparent text-[var(--color-text)] hover:bg-[var(--color-primary-soft)]',
  danger:
    'border-transparent bg-[var(--color-danger)] text-[var(--color-text-inverse)] hover:opacity-90',
};

const sizes: Record<ComponentSize, string> = {
  xs: 'min-h-11 min-w-11 gap-1.5 rounded-[var(--radius-sm)] px-2.5 text-xs',
  sm: 'min-h-11 min-w-11 gap-2 rounded-[var(--radius-sm)] px-3 text-sm',
  md: 'min-h-11 min-w-11 gap-2 rounded-[var(--radius-md)] px-4 text-sm',
  lg: 'min-h-11 min-w-11 gap-2.5 rounded-[var(--radius-md)] px-5 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ComponentSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leadingIcon,
  trailingIcon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-busy={loading}
      disabled={disabled || loading}
      className={`inline-flex cursor-pointer items-center justify-center border font-semibold transition-colors duration-[var(--motion-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}
