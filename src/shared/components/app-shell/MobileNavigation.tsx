'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useEffectEvent } from 'react';
import { FiChevronRight, FiMoreHorizontal, FiX } from 'react-icons/fi';

import type { SafeUser } from '@/modules/auth/types';
import type { SystemHealthSummary } from '@/modules/system-health/types';
import { IconButton } from '@/shared/ui/IconButton';
import { Modal } from '@/shared/ui/Overlays';

import { getVisibleNavigation, navigation } from './navigation';

const primaryRoutes = [
  { href: '/', label: 'Главная' },
  { href: '/rentals', label: 'Аренды' },
  { href: '/map', label: 'Карта' },
  { href: '/vehicles', label: 'Автопарк' },
] as const;

interface MobileNavigationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SafeUser;
  systemHealthSummary: SystemHealthSummary;
}

export function MobileNavigation({ open, onOpenChange, user }: MobileNavigationProps) {
  const pathname = usePathname();
  const close = () => onOpenChange(false);
  const requestClose = useEffectEvent(close);
  useEffect(() => {
    requestClose();
  }, [pathname]);
  useEffect(() => {
    if (!open || typeof window.matchMedia !== 'function') return;
    const desktop = window.matchMedia('(min-width: 768px)');
    const onResize = () => {
      if (desktop.matches) requestClose();
    };
    onResize();
    desktop.addEventListener('change', onResize);
    return () => desktop.removeEventListener('change', onResize);
  }, [open]);

  const authorized = getVisibleNavigation(user);
  const remaining = authorized.filter(
    (item) => !primaryRoutes.some((route) => route.href === item.href),
  );
  const isCurrent = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
  const moreCurrent = remaining.some((item) => isCurrent(item.href));

  return (
    <div className="md:hidden">
      <nav aria-label="Мобильная навигация" className="mobile-dock" data-testid="mobile-dock">
        {primaryRoutes.map((route) => {
          const item = navigation.find((candidate) => candidate.href === route.href)!;
          const Icon = item.icon;
          const content = (
            <>
              <Icon aria-hidden="true" className="size-5" />
              <span>{route.label}</span>
            </>
          );
          if (!authorized.includes(item))
            return (
              <span
                key={route.href}
                className="mobile-dock__item mobile-dock__item--disabled"
                aria-disabled="true"
              >
                {content}
              </span>
            );
          return (
            <Link
              key={route.href}
              href={route.href}
              className="mobile-dock__item"
              aria-current={isCurrent(route.href) ? 'page' : undefined}
              onClick={close}
            >
              {content}
            </Link>
          );
        })}
        <button
          type="button"
          className="mobile-dock__item"
          aria-expanded={open}
          aria-haspopup="dialog"
          data-current={moreCurrent || open}
          onClick={() => onOpenChange(!open)}
        >
          <FiMoreHorizontal aria-hidden="true" className="size-5" />
          <span>Ещё</span>
        </button>
      </nav>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Все разделы"
        backdropClassName="mobile-navigation-backdrop md:hidden"
        className="mobile-navigation-sheet text-[var(--color-text)]"
      >
        <span
          data-sheet-handle
          aria-hidden="true"
          className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-[var(--color-border-strong)]"
        />
        <div className="absolute top-3 right-3">
          <IconButton label="Закрыть меню" variant="ghost" onClick={close}>
            <FiX aria-hidden="true" className="size-5" />
          </IconButton>
        </div>
        <nav aria-label="Все разделы" className="flex flex-col gap-1">
          {remaining.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                aria-current={isCurrent(item.href) ? 'page' : undefined}
                className="mobile-navigation-section"
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                <span className="min-w-0 flex-1">{item.label}</span>
                <FiChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-[var(--color-text-muted)]"
                />
              </Link>
            );
          })}
        </nav>
      </Modal>
    </div>
  );
}
