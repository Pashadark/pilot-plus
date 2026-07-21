'use client';

import { FiBell, FiLogOut, FiMenu, FiMoon, FiSearch, FiSun, FiUser } from 'react-icons/fi';

import { logoutAction } from '@/modules/auth/actions';
import type { SafeUser } from '@/modules/auth/types';
import type { SystemHealthSummary } from '@/modules/system-health/types';
import { useTheme } from '@/shared/providers/ThemeProvider';
import { IconButton } from '@/shared/ui/IconButton';
import { Breadcrumbs, DropdownMenu, SearchInput } from '@/shared/ui';
import type { Breadcrumb } from './AppShell';

import { MobileNavigation } from './MobileNavigation';

export function Header({
  breadcrumbs,
  user,
  mobileNavigationOpen,
  onOpenMobileNavigation,
  onCloseMobileNavigation,
  systemHealthSummary,
}: {
  breadcrumbs: readonly Breadcrumb[];
  user: SafeUser;
  mobileNavigationOpen: boolean;
  onOpenMobileNavigation: () => void;
  onCloseMobileNavigation: () => void;
  systemHealthSummary: SystemHealthSummary;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-[var(--header-height)] items-center border-b bg-[var(--color-surface)] px-4 md:hidden">
        <div className="flex w-full items-center justify-between md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="shrink-0 md:hidden">
              <IconButton label="Открыть меню" variant="ghost" onClick={onOpenMobileNavigation}>
                <FiMenu aria-hidden="true" className="size-5" />
              </IconButton>
            </div>
            <div
              data-testid="mobile-breadcrumbs"
              className="scrollbar-hidden min-w-0 flex-1 overflow-x-auto overscroll-x-contain [&_li]:shrink-0 [&_ol]:w-max [&_ol]:flex-nowrap"
            >
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
              <DropdownMenu
                ariaLabel="Профиль и компания"
                label={
                  <span className="flex size-11 items-center justify-center rounded-[var(--radius-md)] transition-colors hover:bg-[var(--color-primary-soft)]">
                    <FiUser aria-hidden="true" className="size-5" />
                  </span>
                }
              >
                <div className="border-b px-3 py-2">
                  <p className="text-sm font-semibold">Администратор</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Управление Pilot+</p>
                </div>
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
          if (!open) onCloseMobileNavigation();
        }}
        user={user}
        systemHealthSummary={systemHealthSummary}
      />
    </>
  );
}
