'use client';

import { useEffect, useId, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';

export interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const focusable =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function DialogBoundary({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className = '',
  ...props
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() =>
      (panelRef.current?.querySelector<HTMLElement>(focusable) ?? panelRef.current)?.focus(),
    );
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', escape);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', escape);
      document.body.style.overflow = overflow;
      previousFocus.current?.focus();
    };
  }, [open, onOpenChange]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid bg-[color-mix(in_srgb,var(--color-navigation)_55%,transparent)] p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`m-auto w-full max-w-lg rounded-[var(--radius-panel)] border bg-[var(--color-surface)] p-5 shadow-[var(--shadow-floating)] outline-none ${className}`}
        {...props}
      >
        <header className="mb-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="text-[var(--color-text-secondary)]">
              {description}
            </p>
          )}
        </header>
        {children}
        {footer && <footer className="mt-5">{footer}</footer>}
      </div>
    </div>
  );
}
export function Modal(props: ModalProps) {
  return <DialogBoundary {...props} />;
}
export function Drawer({ className = '', ...props }: ModalProps) {
  return (
    <DialogBoundary {...props} className={`mr-0 h-full max-w-md rounded-r-none ${className}`} />
  );
}
export interface BottomSheetProps extends ModalProps {
  snap: 'collapsed' | 'intermediate' | 'expanded';
  onSnapChange: (snap: BottomSheetProps['snap']) => void;
}
export function BottomSheet({ snap, onSnapChange, className = '', ...props }: BottomSheetProps) {
  void onSnapChange;
  return (
    <DialogBoundary
      {...props}
      data-snap={snap}
      className={`mb-0 max-w-none rounded-b-none ${snap === 'collapsed' ? 'max-h-[25dvh]' : snap === 'intermediate' ? 'max-h-[60dvh]' : 'max-h-[90dvh]'} ${className}`}
    />
  );
}

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <span className="group relative inline-flex" aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 hidden -translate-x-1/2 rounded-[var(--radius-sm)] bg-[var(--color-navigation)] px-2 py-1 text-sm text-[var(--color-text-inverse)] group-focus-within:block group-hover:block"
      >
        {content}
      </span>
    </span>
  );
}

export function DropdownMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="min-h-11 min-w-11"
      >
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 min-w-48 rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-1 shadow-[var(--shadow-floating)]"
        >
          {children}
        </div>
      )}
    </div>
  );
}
