'use client';

import { useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';

import type { Breadcrumb } from './AppShell';
import { Header } from './Header';
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
  return window.localStorage.getItem(storageKey) === 'true';
}

function getSidebarServerSnapshot() {
  return false;
}

export function ShellFrame({
  children,
  breadcrumbs,
}: {
  children: ReactNode;
  breadcrumbs: readonly Breadcrumb[];
}) {
  const expanded = useSyncExternalStore(
    subscribeToSidebarStorage,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  );

  function toggleSidebar() {
    window.localStorage.setItem(storageKey, String(!expanded));
    window.dispatchEvent(new Event(sidebarStorageEvent));
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
      <Header breadcrumbs={breadcrumbs} />
      <aside
        data-testid="desktop-sidebar"
        className="fixed inset-y-0 left-0 z-50 hidden w-[var(--sidebar-width)] border-r bg-[var(--color-navigation)] transition-[width] duration-200 md:flex md:flex-col"
      >
        <Sidebar expanded={expanded} onToggle={toggleSidebar} />
      </aside>
      <main className="min-h-screen pt-[var(--header-height)] transition-[padding] duration-200 md:pl-[var(--sidebar-width)]">
        <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
