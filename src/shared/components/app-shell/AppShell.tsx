import type { ReactNode } from 'react';

import { Header } from './Header';
import { Sidebar } from './Sidebar';

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface AppShellProps {
  children: ReactNode;
  breadcrumbs?: readonly Breadcrumb[];
}

export function AppShell({ children, breadcrumbs = [] }: AppShellProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--color-canvas)] text-[var(--color-text)]">
      <Header />
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[var(--sidebar-width)] bg-[var(--color-navigation)] p-5 md:block">
        <div className="mb-8 flex h-11 items-center text-xl font-semibold text-[var(--color-text-inverse)]">
          Pilot+
        </div>
        <Sidebar />
      </aside>
      <main className="min-h-screen pt-[var(--header-height)] md:pl-[var(--sidebar-width)]">
        <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {breadcrumbs.length > 0 ? (
            <nav
              aria-label="Хлебные крошки"
              className="mb-4 text-sm text-[var(--color-text-secondary)]"
            >
              {breadcrumbs.map((item) => item.label).join(' / ')}
            </nav>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}
