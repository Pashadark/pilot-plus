'use client';

import { createPortal } from 'react-dom';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const VIEWPORT_GAP = 8;
const PANEL_GAP = 8;
const MOBILE_BREAKPOINT = 640;
const OPEN_EVENT = 'pilot:header-overlay-open';

type PanelRole = 'dialog' | 'menu';

export function AnchoredPopover({
  ariaLabel,
  panelAriaLabel,
  trigger,
  children,
  panelRole = 'dialog',
  mobileTitle,
  panelClassName = '',
}: {
  ariaLabel: string;
  panelAriaLabel?: string;
  trigger: ReactNode;
  children: ReactNode;
  panelRole?: PanelRole;
  mobileTitle?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [position, setPosition] = useState({ left: VIEWPORT_GAP, top: VIEWPORT_GAP });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const instanceId = useId();
  const titleId = useId();

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const updatePosition = useCallback(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    setMobile(isMobile);
    if (isMobile) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelWidth = panelRef.current.offsetWidth || 320;
    const panelHeight = panelRef.current.offsetHeight || 320;
    const maxLeft = Math.max(VIEWPORT_GAP, window.innerWidth - panelWidth - VIEWPORT_GAP);
    const left = Math.min(Math.max(triggerRect.right - panelWidth, VIEWPORT_GAP), maxLeft);
    const belowTop = triggerRect.bottom + PANEL_GAP;
    const aboveTop = triggerRect.top - panelHeight - PANEL_GAP;
    const maxTop = Math.max(VIEWPORT_GAP, window.innerHeight - panelHeight - VIEWPORT_GAP);
    const top =
      belowTop + panelHeight <= window.innerHeight - VIEWPORT_GAP
        ? belowTop
        : Math.min(Math.max(aboveTop, VIEWPORT_GAP), maxTop);
    setPosition({ left, top });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    panelRef.current?.focus();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const schedulePosition = () => requestAnimationFrame(updatePosition);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) close(true);
    };
    const closeOtherOverlay = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== instanceId) close();
    };

    window.addEventListener('resize', schedulePosition);
    window.addEventListener('scroll', schedulePosition, true);
    window.addEventListener(OPEN_EVENT, closeOtherOverlay);
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutside);
    return () => {
      window.removeEventListener('resize', schedulePosition);
      window.removeEventListener('scroll', schedulePosition, true);
      window.removeEventListener(OPEN_EVENT, closeOtherOverlay);
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [close, instanceId, open, updatePosition]);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      if (next) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: instanceId }));
      return next;
    });
  };

  const panel = open ? (
    <div
      ref={panelRef}
      role={mobile ? 'dialog' : panelRole}
      aria-modal={mobile || undefined}
      aria-labelledby={mobile && mobileTitle ? titleId : undefined}
      aria-label={!mobile || !mobileTitle ? (panelAriaLabel ?? ariaLabel) : undefined}
      data-overlay-layer="header"
      data-mobile-sheet={mobile ? 'true' : 'false'}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('a,[role^="menuitem"]')) close(true);
      }}
      tabIndex={-1}
      className={[
        'fixed z-[120] overflow-y-auto bg-[var(--color-surface)] shadow-[var(--shadow-floating)] outline-none',
        'motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out',
        mobile
          ? 'inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] max-h-[min(78dvh,42rem)] rounded-[var(--radius-panel)] border'
          : 'max-h-[calc(100dvh-1rem)] rounded-[var(--radius-panel)] border',
        panelClassName,
      ].join(' ')}
      style={mobile ? undefined : { left: position.left, top: position.top }}
    >
      {mobile && mobileTitle ? (
        <div className="sticky top-0 z-10 border-b bg-[var(--color-surface)] px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold">
            {mobileTitle}
          </h2>
        </div>
      ) : null}
      {children}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup={panelRole}
        aria-expanded={open}
        onClick={toggle}
        className="min-h-11 min-w-11"
      >
        {trigger}
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </>
  );
}
