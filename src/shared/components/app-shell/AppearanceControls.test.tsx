// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThemeProvider } from '@/shared/providers/ThemeProvider';

import { InterfaceModeMenuItems, ThemeSwitch } from './AppearanceControls';

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

describe('appearance controls', () => {
  it('switches the color scheme from the top-bar control', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeSwitch />
      </ThemeProvider>,
    );

    const themeSwitch = screen.getByRole('switch', { name: 'Тёмная тема' });
    expect(themeSwitch.getAttribute('aria-checked')).toBe('false');

    await user.click(themeSwitch);

    expect(themeSwitch.getAttribute('aria-checked')).toBe('true');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('switches between the new and classic interfaces without changing the color scheme', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <InterfaceModeMenuItems />
      </ThemeProvider>,
    );

    const obsidian = screen.getByRole('menuitemradio', { name: 'Новый интерфейс' });
    const classic = screen.getByRole('menuitemradio', { name: 'Классический интерфейс' });

    expect(obsidian.getAttribute('aria-checked')).toBe('true');
    expect(classic.getAttribute('aria-checked')).toBe('false');

    await user.click(classic);

    expect(document.documentElement.dataset.interface).toBe('classic');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(classic.getAttribute('aria-checked')).toBe('true');
  });
});
