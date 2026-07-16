'use client';

import {
  cloneElement,
  isValidElement,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';

export interface ModalProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title' | 'children' | 'role' | 'aria-modal' | 'aria-labelledby' | 'aria-describedby' | 'tabIndex'
> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const focusable =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let scrollLockCount = 0;
let savedBodyOverflow = '';

function lockBodyScroll() {
  if (scrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount += 1;
  return () => {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) document.body.style.overflow = savedBodyOverflow;
  };
}

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
  const requestOpenChange = useEffectEvent(onOpenChange);
  useEffect(() => {
    if (!open) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlockBodyScroll = lockBodyScroll();
    const timer = window.setTimeout(() =>
      (panelRef.current?.querySelector<HTMLElement>(focusable) ?? panelRef.current)?.focus(),
    );
    const keyboard = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestOpenChange(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const candidates = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusable),
      ).filter((element) => element.getClientRects().length > 0);
      if (candidates.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = candidates[0];
      const last = candidates[candidates.length - 1];
      if (!panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panelRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', keyboard);
      unlockBodyScroll();
      previousFocus.current?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid bg-[color-mix(in_srgb,var(--color-navigation)_55%,transparent)] p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div
        {...props}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`m-auto w-full max-w-lg rounded-[var(--radius-panel)] border bg-[var(--color-surface)] p-5 shadow-[var(--shadow-floating)] outline-none ${className}`}
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
  const snaps: readonly BottomSheetProps['snap'][] = ['collapsed', 'intermediate', 'expanded'];
  return (
    <DialogBoundary
      {...props}
      data-snap={snap}
      className={`mb-0 max-w-none rounded-b-none ${snap === 'collapsed' ? 'max-h-[25dvh]' : snap === 'intermediate' ? 'max-h-[60dvh]' : 'max-h-[90dvh]'} ${className}`}
    >
      <div role="group" aria-label="Положение нижней панели" className="mb-3 flex flex-wrap gap-2">
        {snaps.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={snap === value}
            onClick={() => onSnapChange(value)}
            className="min-h-11 min-w-11 rounded-[var(--radius-sm)] px-3 aria-pressed:bg-[var(--color-primary-soft)]"
          >
            {value === 'collapsed'
              ? 'Свернуть'
              : value === 'intermediate'
                ? 'Наполовину'
                : 'Развернуть'}
          </button>
        ))}
      </div>
      {props.children}
    </DialogBoundary>
  );
}

type TooltipTriggerProps = { 'aria-describedby'?: string };

export function Tooltip({
  content,
  children,
}: {
  content: ReactNode;
  children: ReactElement<TooltipTriggerProps>;
}) {
  const id = useId();
  if (!isValidElement<TooltipTriggerProps>(children)) return children;
  const describedBy = [children.props['aria-describedby'], id].filter(Boolean).join(' ');
  return (
    <span className="group relative inline-flex">
      {cloneElement(children, { 'aria-describedby': describedBy })}
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
export function Popover({ label, children }: { label: string; children: ReactNode }) {
  return <DropdownMenu label={label}>{children}</DropdownMenu>;
}
export function ConfirmationDialog({
  onConfirm,
  ...props
}: ModalProps & { onConfirm: () => void }) {
  return (
    <Modal
      {...props}
      footer={
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-11 rounded-[var(--radius-md)] bg-[var(--color-danger)] px-4 text-[var(--color-text-inverse)]"
        >
          Подтвердить
        </button>
      }
    />
  );
}
