'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { FiLogOut, FiSettings } from 'react-icons/fi';
import { HeaderSearch } from '@/modules/search/HeaderSearch';

import { logoutAction } from '@/modules/auth/actions';
import type { SafeUser } from '@/modules/auth/types';
import { NotificationCenter } from '@/modules/notifications/NotificationCenter';
import type { PilotNotification } from '@/modules/notifications/types';
import type { NotificationMeta } from '@/modules/notifications/pagination';
import type { SystemHealthSummary } from '@/modules/system-health/types';
import { Avatar, DropdownMenu } from '@/shared/ui';
import type { Breadcrumb } from './AppShell';

import { ThemeSwitch } from './AppearanceControls';
import { MobileNavigation } from './MobileNavigation';

function subscribeScroll(listener: () => void) {
  window.addEventListener('scroll', listener, { passive: true });
  return () => window.removeEventListener('scroll', listener);
}
const getScrolled = () => window.scrollY > 8;
const getServerScrolled = () => false;

export function Header({
  user,
  mobileNavigationOpen,
  onOpenMobileNavigation,
  onCloseMobileNavigation,
  systemHealthSummary,
  notifications,
  notificationMeta,
}: {
  breadcrumbs: readonly Breadcrumb[];
  user: SafeUser;
  mobileNavigationOpen: boolean;
  onOpenMobileNavigation: () => void;
  onCloseMobileNavigation: () => void;
  systemHealthSummary: SystemHealthSummary;
  notifications: readonly PilotNotification[];
  notificationMeta?: NotificationMeta;
}) {
  const scrolled = useSyncExternalStore(subscribeScroll, getScrolled, getServerScrolled);
  return (
    <>
      <header
        data-testid="app-header"
        data-scrolled={scrolled}
        data-interface-shell="header"
        style={{
          backgroundColor: scrolled ? 'var(--color-surface)' : 'transparent',
          borderColor: scrolled ? 'var(--color-border)' : 'transparent',
          boxShadow: scrolled ? 'var(--shadow-card)' : 'none',
        }}
        className="fixed inset-x-0 top-0 z-40 flex h-[var(--header-height)] items-center border-b px-4 transition-[left,background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none md:left-[var(--sidebar-width)] md:px-5"
      >
        <div className="flex w-full items-center gap-2">
          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <Link
              href="/"
              aria-label="СУПА ПРО — главная"
              className="grid size-9 place-items-center rounded-xl bg-[var(--color-primary)] text-sm font-black text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              СП
            </Link>
          </div>
          <div className="mr-auto max-w-[720px] min-w-0 flex-1">
            <HeaderSearch />
          </div>
          <div className="flex items-center justify-end gap-1 md:gap-2">
            <NotificationCenter
              key={`${notificationMeta?.unreadCount ?? ''}:${notifications[0]?.id ?? ''}`}
              notifications={notifications}
              notificationMeta={notificationMeta}
              globalScope={user.role === 'SUPER_ADMIN'}
            />
            <ThemeSwitch />
            <Link
              href="/profile"
              aria-label="Настройки"
              className="hidden size-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)] sm:inline-flex"
            >
              <FiSettings aria-hidden="true" className="size-5" />
            </Link>
            <div className="ml-1 border-l pl-2">
              <DropdownMenu
                ariaLabel="Профиль и компания"
                label={
                  <span className="flex size-11 items-center justify-center rounded-[var(--radius-md)] transition-colors hover:bg-[var(--color-primary-soft)]">
                    <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                  </span>
                }
              >
                <div className="border-b px-3 py-2">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{user.email}</p>
                </div>
                <Link
                  href="/profile"
                  role="menuitem"
                  className="flex min-h-11 items-center rounded-[var(--radius-sm)] px-3 text-sm font-medium transition-colors hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                  Открыть профиль
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-3 text-left text-sm font-medium transition-colors hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                  >
                    <FiLogOut aria-hidden="true" />
                    Выйти
                  </button>
                </form>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      <MobileNavigation
        open={mobileNavigationOpen}
        onOpenChange={(open) => {
          if (open) onOpenMobileNavigation();
          else onCloseMobileNavigation();
        }}
        user={user}
        systemHealthSummary={systemHealthSummary}
      />
    </>
  );
}
