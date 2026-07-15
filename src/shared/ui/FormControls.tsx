'use client';

import { useId, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';

export interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

const controlClass =
  'min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-[var(--color-text)] outline-none transition-colors focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-55';

function descriptions(id: string, hint?: string, error?: string, supplied?: string) {
  return (
    [supplied, hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  );
}

export type InputProps = FieldShellProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'required' | 'aria-invalid'>;

export function Input({
  label,
  hint,
  error,
  required,
  id: suppliedId,
  'aria-describedby': suppliedDescription,
  className = '',
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <label className="grid gap-1.5" htmlFor={id}>
      <span className="text-sm font-medium">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <input
        {...props}
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptions(id, hint, error, suppliedDescription)}
        className={`${controlClass} ${className}`}
      />
      {hint && (
        <span id={`${id}-hint`} className="text-sm text-[var(--color-text-secondary)]">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </span>
      )}
    </label>
  );
}

export type SelectProps = FieldShellProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'required' | 'aria-invalid'>;

export function Select({
  label,
  hint,
  error,
  required,
  id: suppliedId,
  'aria-describedby': suppliedDescription,
  className = '',
  children,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <label className="grid gap-1.5" htmlFor={id}>
      <span className="text-sm font-medium">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <select
        {...props}
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptions(id, hint, error, suppliedDescription)}
        className={`${controlClass} ${className}`}
      >
        {children}
      </select>
      {hint && (
        <span id={`${id}-hint`} className="text-sm text-[var(--color-text-secondary)]">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </span>
      )}
    </label>
  );
}

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function Checkbox({ className = '', ...props }: CheckboxProps) {
  return (
    <input
      {...props}
      type="checkbox"
      className={`min-h-11 min-w-11 accent-[var(--color-primary)] ${className}`}
    />
  );
}

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'>;

export function Switch({ className = '', ...props }: SwitchProps) {
  return (
    <input
      {...props}
      type="checkbox"
      role="switch"
      className={`min-h-11 min-w-11 accent-[var(--color-primary)] ${className}`}
    />
  );
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  'aria-label'?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className="min-h-11 min-w-11 rounded-[var(--radius-sm)] px-3 aria-pressed:bg-[var(--color-surface)]"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input {...props} type="search" className={`${controlClass} ${className}`} />;
}
