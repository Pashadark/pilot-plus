'use client';

import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const storageKey = 'pilot-theme';
const themeStorageEvent = 'pilot-theme-storage';

function getThemeSnapshot(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function getThemeServerSnapshot(): Theme {
  return 'light';
}

function subscribeToTheme(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== storageKey) return;
    document.documentElement.dataset.theme = event.newValue === 'dark' ? 'dark' : 'light';
    onStoreChange();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(themeStorageEvent, onStoreChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(themeStorageEvent, onStoreChange);
  };
}

function persistTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(storageKey, theme);
  } catch {
    // Тема продолжает работать, даже если браузер запретил постоянное хранилище.
  }
  window.dispatchEvent(new Event(themeStorageEvent));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getThemeServerSnapshot);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: persistTheme,
      toggleTheme: () => persistTheme(getThemeSnapshot() === 'light' ? 'dark' : 'light'),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme должен использоваться внутри ThemeProvider');
  return value;
}
