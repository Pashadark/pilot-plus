'use client';

import { FiMoon, FiSun } from 'react-icons/fi';

import { useTheme } from '@/shared/providers/ThemeProvider';

export function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-label="Тёмная тема"
      aria-checked={dark}
      onClick={toggleTheme}
      className="relative flex h-9 w-16 shrink-0 cursor-pointer items-center justify-between rounded-full border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-2 text-[var(--color-text-secondary)] shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] transition-colors duration-[var(--motion-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
    >
      <FiSun aria-hidden="true" className="size-3.5" />
      <FiMoon aria-hidden="true" className="size-3.5" />
      <span
        aria-hidden="true"
        className={`absolute top-1 left-1 grid size-7 place-items-center rounded-full bg-[var(--color-surface)] text-[var(--color-primary)] shadow-[0_3px_10px_rgb(15_23_42/0.18)] transition-transform duration-[var(--motion-normal)] ease-[cubic-bezier(0.16,1,0.3,1)] ${dark ? 'translate-x-7' : 'translate-x-0'}`}
      >
        {dark ? <FiMoon className="size-3.5" /> : <FiSun className="size-3.5" />}
      </span>
    </button>
  );
}
