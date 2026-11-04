// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeProvider';
function Probe() {
  const { theme, interfaceMode, toggleTheme } = useTheme();
  return (
    <>
      <output>
        {interfaceMode}:{theme}
      </output>
      <button onClick={toggleTheme}>Toggle</button>
    </>
  );
}
beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.theme = 'light';
  document.documentElement.dataset.interface = 'graphite';
});
afterEach(cleanup);
it('keeps graphite when switching light and dark', async () => {
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  await userEvent.setup().click(screen.getByRole('button'));
  expect(screen.getByText('graphite:dark')).toBeTruthy();
  expect(localStorage.getItem('pilot-theme')).toBe('dark');
});
it.each(['classic', 'material', 'obsidian'])('rejects legacy %s from other tabs', (mode) => {
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  act(() =>
    window.dispatchEvent(new StorageEvent('storage', { key: 'pilot-interface', newValue: mode })),
  );
  expect(document.documentElement.dataset.interface).toBe('graphite');
  expect(screen.getByText('graphite:light')).toBeTruthy();
});
it('keeps graphite after storage is cleared', () => {
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
  expect(document.documentElement.dataset.interface).toBe('graphite');
});
