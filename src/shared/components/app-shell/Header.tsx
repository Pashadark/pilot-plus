'use client';

import { useCallback, useState } from 'react';
import { FiMenu, FiMoon, FiSun } from 'react-icons/fi';

import { useTheme } from '@/shared/providers/ThemeProvider';
import { IconButton } from '@/shared/ui/IconButton';

import { MobileNavigation } from './MobileNavigation';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-[var(--header-height)] items-center border-b bg-[var(--color-surface)] px-4 md:pl-[var(--sidebar-width)]">
        <div className="flex w-full items-center justify-between md:px-6">
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <IconButton label="Открыть меню" variant="ghost" onClick={() => setMenuOpen(true)}>
                <FiMenu aria-hidden="true" className="size-5" />
              </IconButton>
            </div>
            <span className="font-semibold text-[var(--color-text)] md:hidden">Pilot+</span>
          </div>
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
        </div>
      </header>
      <MobileNavigation open={menuOpen} onClose={closeMenu} />
    </>
  );
}
