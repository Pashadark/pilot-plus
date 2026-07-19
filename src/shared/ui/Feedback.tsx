import type { HTMLAttributes, ReactNode } from 'react';

export interface FeedbackProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

const Feedback = ({
  title,
  description,
  action,
  className = '',
}: FeedbackProps & { className?: string }) => (
  <div
    className={`grid gap-2 rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-4 ${className}`}
  >
    <strong>{title}</strong>
    {description && <p className="text-[var(--color-text-secondary)]">{description}</p>}
    {action}
  </div>
);

export function Alert({
  tone = 'info',
  title,
  description,
  action,
}: FeedbackProps & { tone?: 'info' | 'success' | 'warning' | 'danger' }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`rounded-[var(--radius-md)] border p-4 ${tone === 'danger' ? 'bg-[var(--color-danger-soft)]' : tone === 'warning' ? 'bg-[var(--color-warning-soft)]' : tone === 'success' ? 'bg-[var(--color-success-soft)]' : 'bg-[var(--color-primary-soft)]'}`}
    >
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Spinner({
  label = 'Загрузка',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block size-6 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-primary)] ${className}`}
    />
  );
}
export function Skeleton(props: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={`min-h-4 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-border)] ${props.className ?? ''}`}
    />
  );
}
export function EmptyState(props: FeedbackProps) {
  return <Feedback {...props} />;
}
export function ErrorState(props: FeedbackProps) {
  return (
    <Feedback {...props} className="border-[var(--color-danger)] bg-[var(--color-danger-soft)]" />
  );
}
export function Progress({ value, label }: { value: number; label: string }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="grid gap-2">
      <span>
        {label}: {safe}%
      </span>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safe}
        className="h-2 overflow-hidden rounded-full bg-[var(--color-border)]"
      >
        <span className="block h-full bg-[var(--color-primary)]" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}
