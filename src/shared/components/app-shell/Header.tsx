'use client';

import { useCallback, useState } from 'react';
import { FiBell, FiMenu, FiMoon, FiSearch, FiSun, FiUser } from 'react-icons/fi';

import { useTheme } from '@/shared/providers/ThemeProvider';
import { IconButton } from '@/shared/ui/IconButton';
import { Breadcrumbs, SearchInput } from '@/shared/ui';
import type { Breadcrumb } from './AppShell';

import { MobileNavigation } from './MobileNavigation';

export function Header({ breadcrumbs }: { breadcrumbs: readonly Breadcrumb[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-[var(--header-height)] items-center border-b bg-[var(--color-surface)] px-4 transition-[padding] duration-200 md:pl-[var(--sidebar-width)]">
        <div className="flex w-full items-center justify-between md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="md:hidden">
              <IconButton label="Открыть меню" variant="ghost" onClick={() => setMenuOpen(true)}>
                <FiMenu aria-hidden="true" className="size-5" />
              </IconButton>
            </div>
            <span className="font-semibold text-[var(--color-text)] md:hidden">Pilot+</span>
            <div className="hidden md:block">
              <Breadcrumbs items={breadcrumbs} />
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <div className="relative hidden h-11 w-64 items-center lg:flex">
              <FiSearch
                aria-hidden="true"
                className="pointer-events-none absolute left-3 z-10 text-[var(--color-text-muted)]"
              />
              <SearchInput
                aria-label="Глобальный поиск"
                placeholder="Поиск в Pilot+"
                className="h-10 pl-10"
              />
            </div>
            <IconButton label="Уведомления" variant="ghost">
              <FiBell aria-hidden="true" />
            </IconButton>
            <IconButton
              label={theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'}
              variant="ghost"
              onClick={toggleTheme}
            >
              {theme === 'light' ? (
                <FiMoon aria-hidden="true" className="size-5" />
              ) : (
                <FiSun aria-hidden="true" className="size-5" />
              )}
            </IconButton>
            <div className="ml-1 border-l pl-2">
              <IconButton label="Профиль и компания" variant="ghost">
                <FiUser aria-hidden="true" className="size-5" />
              </IconButton>
            </div>
          </div>
        </div>
      </header>
      <MobileNavigation open={menuOpen} onClose={closeMenu} />
    </>
  );
}
