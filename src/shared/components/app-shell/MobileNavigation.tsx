'use client';

import { useEffect, useRef } from 'react';
import { FiX } from 'react-icons/fi';

import { IconButton } from '@/shared/ui/IconButton';

import { Sidebar } from './Sidebar';

interface MobileNavigationProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNavigation({ open, onClose }: MobileNavigationProps) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Закрыть меню"
        className="absolute inset-0 bg-[color:var(--color-navigation)]/60"
        onClick={onClose}
      />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Мобильная навигация"
        className="relative flex h-full w-[min(20rem,calc(100vw-3rem))] flex-col bg-[var(--color-navigation)] p-4 shadow-[var(--shadow-floating)]"
      >
        <div className="mb-5 flex min-h-11 items-center justify-between">
          <span className="text-lg font-semibold text-[var(--color-text-inverse)]">Pilot+</span>
          <IconButton label="Закрыть меню" variant="ghost" onClick={onClose}>
            <FiX aria-hidden="true" className="size-5" />
          </IconButton>
        </div>
        <Sidebar onNavigate={onClose} />
      </aside>
    </div>
  );
}
