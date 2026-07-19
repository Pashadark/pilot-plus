import type { IconType } from 'react-icons';
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';

import type { ToastRecord, ToastTone } from '@/shared/providers/toast-state';

const toneStyles: Record<ToastTone, { icon: IconType; accent: string; surface: string }> = {
  success: {
    icon: FiCheckCircle,
    accent: 'text-[var(--color-success)]',
    surface: 'border-l-[var(--color-success)]',
  },
  warning: {
    icon: FiAlertTriangle,
    accent: 'text-[var(--color-warning)]',
    surface: 'border-l-[var(--color-warning)]',
  },
  danger: {
    icon: FiAlertCircle,
    accent: 'text-[var(--color-danger)]',
    surface: 'border-l-[var(--color-danger)]',
  },
  info: {
    icon: FiInfo,
    accent: 'text-[var(--color-primary)]',
    surface: 'border-l-[var(--color-primary)]',
  },
};

export interface ToastProps {
  toast: ToastRecord;
  onDismiss: () => void;
  onPauseChange: (paused: boolean) => void;
}

export function Toast({ toast, onDismiss, onPauseChange }: ToastProps) {
  const style = toneStyles[toast.tone];
  const Icon = style.icon;

  return (
    <article
      role={toast.tone === 'danger' ? 'alert' : 'status'}
      data-toast-tone={toast.tone}
      onMouseEnter={() => onPauseChange(true)}
      onMouseLeave={() => onPauseChange(false)}
      onFocus={() => onPauseChange(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onPauseChange(false);
      }}
      className={`pointer-events-auto grid grid-cols-[auto_1fr_auto] gap-3 rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] bg-[var(--color-elevated)] p-4 text-[var(--color-text)] shadow-[var(--shadow-floating)] ${style.surface}`}
    >
      <Icon aria-hidden="true" className={`mt-0.5 size-5 ${style.accent}`} />
      <div className="min-w-0">
        <strong className="block text-sm font-semibold">{toast.title}</strong>
        {toast.description ? (
          <p className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">
            {toast.description}
          </p>
        ) : null}
        {toast.actionLabel && toast.onAction ? (
          <button
            type="button"
            onClick={toast.onAction}
            className={`mt-2 min-h-11 text-sm font-semibold ${style.accent}`}
          >
            {toast.actionLabel}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Закрыть уведомление"
        onClick={onDismiss}
        className="-m-2 flex size-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      >
        <FiX aria-hidden="true" className="size-5" />
      </button>
    </article>
  );
}
