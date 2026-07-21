'use client';

import {
  useCallback,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';

import type { SafeUser } from '@/modules/auth/types';
import type { SystemHealthSummary } from '@/modules/system-health/types';
import { useGlobalShortcuts } from '@/shared/hooks/useGlobalShortcuts';
import { useTheme } from '@/shared/providers/ThemeProvider';

import type { Breadcrumb } from './AppShell';
import { Header } from './Header';
import { ScrollToTopButton } from './ScrollToTopButton';
import { Sidebar } from './Sidebar';

const storageKey = 'pilot-sidebar-expanded';
const sidebarStorageEvent = 'pilot-sidebar-storage';

function subscribeToSidebarStorage(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(sidebarStorageEvent, onStoreChange);

  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(sidebarStorageEvent, onStoreChange);
  };
}

function getSidebarSnapshot() {
  try {
    return window.localStorage.getItem(storageKey) !== 'false';
  } catch {
    return true;
  }
}

function getSidebarServerSnapshot() {
  return true;
}

export function ShellFrame({
  children,
  breadcrumbs,
  systemHealthSummary,
  user,
}: {
  children: ReactNode;
  breadcrumbs: readonly Breadcrumb[];
  systemHealthSummary: SystemHealthSummary;
  user: SafeUser;
}) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const { toggleTheme } = useTheme();
  const expanded = useSyncExternalStore(
    subscribeToSidebarStorage,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  );
  const openMobileNavigation = useCallback(() => setMobileNavigationOpen(true), []);
  const closeMobileNavigation = useCallback(() => setMobileNavigationOpen(false), []);
  const focusSearch = useCallback(() => {
    const search = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="search"]'),
    ).find((input) => {
      const style = window.getComputedStyle(input);
      return (
        !input.disabled &&
        !input.readOnly &&
        input.getAttribute('aria-disabled') !== 'true' &&
        input.getAttribute('aria-hidden') !== 'true' &&
        input.getClientRects().length > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      );
    });
    if (!search) return false;

    search.focus();
    return document.activeElement === search;
  }, []);

  useGlobalShortcuts({
    focusSearch,
    closeOverlay: closeMobileNavigation,
    toggleTheme,
  });

  function toggleSidebar() {
    try {
      window.localStorage.setItem(storageKey, String(!expanded));
      window.dispatchEvent(new Event(sidebarStorageEvent));
    } catch {
      // При недоступном хранилище навигация остаётся безопасно свёрнутой.
    }
  }

  const sidebarWidth = expanded
    ? 'var(--sidebar-width-expanded)'
    : 'var(--sidebar-width-collapsed)';

  return (
    <div
      data-testid="app-shell"
      data-sidebar-expanded={expanded}
      style={{ '--sidebar-width': sidebarWidth } as CSSProperties}
      className="min-h-screen overflow-x-hidden bg-[var(--color-canvas)] text-[var(--color-text)]"
    >
      <Header
        breadcrumbs={breadcrumbs}
        user={user}
        mobileNavigationOpen={mobileNavigationOpen}
        onOpenMobileNavigation={openMobileNavigation}
        onCloseMobileNavigation={closeMobileNavigation}
        systemHealthSummary={systemHealthSummary}
      />
      <aside
        data-testid="desktop-sidebar"
        className="fixed inset-y-0 left-0 z-50 hidden w-[var(--sidebar-width)] border-r bg-[var(--color-navigation)] transition-[width] duration-200 md:flex md:flex-col"
      >
        <Sidebar
          expanded={expanded}
          onToggle={toggleSidebar}
          user={user}
          systemHealthSummary={systemHealthSummary}
        />
      </aside>
      <main className="min-h-screen pt-[var(--header-height)] transition-[padding] duration-200 md:pt-0 md:pl-[var(--sidebar-width)]">
        <div className="mx-auto max-w-[1680px] p-4 lg:p-5">{children}</div>
      </main>
      <ScrollToTopButton />
    </div>
  );
}
