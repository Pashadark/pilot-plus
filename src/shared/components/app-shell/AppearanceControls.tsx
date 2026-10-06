'use client';

import { FiCheck, FiMoon, FiSun } from 'react-icons/fi';

import { useTheme, type InterfaceMode } from '@/shared/providers/ThemeProvider';

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

const modes: readonly {
  mode: InterfaceMode;
  label: string;
  description: string;
}[] = [
  {
    mode: 'material',
    label: 'Material — предпросмотр',
    description: 'Новые компоненты и формы',
  },
  {
    mode: 'obsidian',
    label: 'Новый интерфейс',
    description: 'Основной дизайн',
  },
  {
    mode: 'classic',
    label: 'Классический интерфейс',
    description: 'Прежний дизайн',
  },
];

export function InterfaceModeMenuItems() {
  const { interfaceMode, setInterfaceMode } = useTheme();

  return (
    <div className="border-y border-[var(--color-border)] py-1">
      {modes.map(({ mode, label, description }) => {
        const active = interfaceMode === mode;

        return (
          <button
            key={mode}
            type="button"
            role="menuitemradio"
            aria-label={label}
            aria-checked={active}
            onClick={() => setInterfaceMode(mode)}
            className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] px-3 text-left transition-colors duration-[var(--motion-fast)] hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            <span
              aria-hidden="true"
              className={`grid size-5 shrink-0 place-items-center rounded-full border ${
                active
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                  : 'border-[var(--color-border-strong)] text-transparent'
              }`}
            >
              <FiCheck className="size-3" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--color-text)]">{label}</span>
              <span className="block text-xs text-[var(--color-text-secondary)]">
                {description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
