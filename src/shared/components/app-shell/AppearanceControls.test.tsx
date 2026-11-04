// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThemeProvider } from '@/shared/providers/ThemeProvider';

import { ThemeSwitch } from './AppearanceControls';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.dataset.theme = 'light';
  document.documentElement.dataset.interface = 'graphite';
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

});
