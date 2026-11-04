'use client';

import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
export type InterfaceMode = 'graphite';

interface ThemeContextValue {
  theme: Theme;
  interfaceMode: InterfaceMode;
  setTheme: (theme: Theme) => void;
  setInterfaceMode: (mode: InterfaceMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const themeStorageKey = 'pilot-theme';
const interfaceStorageKey = 'pilot-interface';
const appearanceStorageEvent = 'pilot-appearance-storage';

function getThemeSnapshot(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function getThemeServerSnapshot(): Theme {
  return 'light';
}

function getInterfaceSnapshot(): InterfaceMode {
  return 'graphite';
}

function getInterfaceServerSnapshot(): InterfaceMode {
  return 'graphite';
}

function subscribeToAppearance(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === themeStorageKey) {
      document.documentElement.dataset.theme = event.newValue === 'dark' ? 'dark' : 'light';
    } else if (event.key === interfaceStorageKey) {
      document.documentElement.dataset.interface = 'graphite';
    } else if (event.key === null) {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.dataset.interface = 'graphite';
    } else {
      return;
    }
    onStoreChange();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(appearanceStorageEvent, onStoreChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(appearanceStorageEvent, onStoreChange);
  };
}

function persistTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // Тема продолжает работать, даже если браузер запретил постоянное хранилище.
  }
  window.dispatchEvent(new Event(appearanceStorageEvent));
}

function persistInterface() {
  document.documentElement.dataset.interface = 'graphite';
  try {
    window.localStorage.setItem(interfaceStorageKey, 'graphite');
  } catch {
    // Интерфейс продолжает работать, даже если браузер запретил постоянное хранилище.
  }
  window.dispatchEvent(new Event(appearanceStorageEvent));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToAppearance,
    getThemeSnapshot,
    getThemeServerSnapshot,
  );
  const interfaceMode = useSyncExternalStore(
    subscribeToAppearance,
    getInterfaceSnapshot,
    getInterfaceServerSnapshot,
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      interfaceMode,
      setTheme: persistTheme,
      setInterfaceMode: persistInterface,
      toggleTheme: () => persistTheme(getThemeSnapshot() === 'light' ? 'dark' : 'light'),
    }),
    [interfaceMode, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme должен использоваться внутри ThemeProvider');
  return value;
}
