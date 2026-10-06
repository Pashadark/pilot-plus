// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThemeProvider, useTheme } from './ThemeProvider';

function AppearanceProbe() {
  const { interfaceMode, setInterfaceMode, setTheme, theme } = useTheme();

  return (
    <div>
      <output aria-label="Текущая тема">{theme}</output>
      <output aria-label="Текущий интерфейс">{interfaceMode}</output>
      <button type="button" onClick={() => setTheme('dark')}>
        dark
      </button>
      <button type="button" onClick={() => setInterfaceMode('classic')}>
        classic
      </button>
      <button type="button" onClick={() => setInterfaceMode('material')}>material</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.dataset.theme = 'light';
  document.documentElement.dataset.interface = 'obsidian';
});

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.interface;
});

describe('ThemeProvider appearance state', () => {
  it('supports material and can return to the previous interface without changing theme', async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><AppearanceProbe /></ThemeProvider>);
    await user.click(screen.getByRole('button', { name: 'material' }));
    expect(screen.getByLabelText('Текущий интерфейс').textContent).toBe('material');
    expect(localStorage.getItem('pilot-interface')).toBe('material');
    await user.click(screen.getByRole('button', { name: 'classic' }));
    expect(screen.getByLabelText('Текущий интерфейс').textContent).toBe('classic');
    act(() => window.dispatchEvent(new StorageEvent('storage', {key: 'pilot-interface', newValue: 'material'})));
    expect(screen.getByLabelText('Текущий интерфейс').textContent).toBe('material');
    expect(screen.getByLabelText('Текущая тема').textContent).toBe('light');
  });
  it('stores theme and interface independently', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <AppearanceProbe />
      </ThemeProvider>,
    );

    expect(screen.getByLabelText('Текущая тема').textContent).toBe('light');
    expect(screen.getByLabelText('Текущий интерфейс').textContent).toBe('obsidian');

    await user.click(screen.getByRole('button', { name: 'dark' }));
    await user.click(screen.getByRole('button', { name: 'classic' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.interface).toBe('classic');
    expect(window.localStorage.getItem('pilot-theme')).toBe('dark');
    expect(window.localStorage.getItem('pilot-interface')).toBe('classic');
    expect(screen.getByLabelText('Текущая тема').textContent).toBe('dark');
    expect(screen.getByLabelText('Текущий интерфейс').textContent).toBe('classic');
  });

  it('normalizes unknown DOM values to safe defaults', () => {
    document.documentElement.dataset.theme = 'neon';
    document.documentElement.dataset.interface = 'unknown';

    render(
      <ThemeProvider>
        <AppearanceProbe />
      </ThemeProvider>,
    );

    expect(screen.getByLabelText('Текущая тема').textContent).toBe('light');
    expect(screen.getByLabelText('Текущий интерфейс').textContent).toBe('obsidian');
  });

  it('restores safe defaults when another tab clears appearance storage', () => {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.dataset.interface = 'classic';

    render(
      <ThemeProvider>
        <AppearanceProbe />
      </ThemeProvider>,
    );

    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));

    expect(screen.getByLabelText('Текущая тема').textContent).toBe('light');
    expect(screen.getByLabelText('Текущий интерфейс').textContent).toBe('obsidian');
  });

  it('defines complete light and dark Obsidian token layers', () => {
    const stylesheet = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

    expect(stylesheet).toContain(":root[data-interface='obsidian'][data-theme='light']");
    expect(stylesheet).toContain(":root[data-interface='obsidian'][data-theme='dark']");
    expect(stylesheet).toContain('--color-ice:');
    expect(stylesheet).toContain('--shell-gutter:');
  });
});
