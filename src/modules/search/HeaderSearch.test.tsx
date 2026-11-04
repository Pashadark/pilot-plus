// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import { HeaderSearch } from './HeaderSearch';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('reserves scrollbar width while search is open and restores padding', () => {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
  vi.stubGlobal('innerWidth', 1020);
  document.body.style.paddingRight = '8px';
  render(<HeaderSearch />);
  fireEvent.click(screen.getByRole('button', { name: 'Открыть глобальный поиск' }));
  expect(document.body.style.paddingRight).toBe('28px');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(document.body.style.paddingRight).toBe('8px');
  document.body.style.paddingRight = '';
});
it('opens centered modal with keyboard shortcut and closes on escape', () => {
  render(<HeaderSearch />);
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  expect(screen.getByRole('dialog', { name: 'Глобальный поиск' })).toBeTruthy();
  expect(screen.getByText('Что можно найти')).toBeTruthy();
  expect(screen.getByRole('dialog').className).toContain('!fixed');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('shows an inset pill before opening and anchors results to its width', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 280,
    bottom: 60,
    width: 600,
    top: 16,
    right: 880,
    height: 44,
    x: 280,
    y: 16,
    toJSON: () => ({}),
  });
  render(<HeaderSearch />);
  const trigger = screen.getByRole('button', { name: 'Открыть глобальный поиск' });
  expect(trigger.className).toContain('rounded-full');
  expect(trigger.className).toContain('shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)]');
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog');
  expect(dialog.style.left).toBe('280px');
  expect(dialog.style.width).toBe('600px');
  expect(dialog.style.top).toBe('68px');
});
it('renders the dropdown outside the clipping header', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }),
  );
  render(
    <header data-testid="clipped-header" style={{ overflow: 'hidden', height: 64 }}>
      <HeaderSearch />
    </header>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Открыть глобальный поиск' }));
  expect(screen.getByRole('dialog').closest('header')).toBeNull();
  fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('shows grouped results linking directly to a car and closes with escape', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'v1',
            group: 'Автомобили',
            title: 'Volkswagen Polo',
            subtitle: 'Р400АМ997',
            href: '/vehicles/v1',
          },
        ],
      }),
    }),
  );
  render(<HeaderSearch />);
  fireEvent.click(screen.getByRole('button', { name: 'Открыть глобальный поиск' }));
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'Р400' } });
  await waitFor(() => expect(screen.getByRole('option').getAttribute('href')).toBe('/vehicles/v1'));
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).toBeNull();
});
it('shows a useful empty result', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }),
  );
  render(<HeaderSearch />);
  fireEvent.click(screen.getByRole('button', { name: 'Открыть глобальный поиск' }));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'неизвестно' } });
  await waitFor(() => expect(screen.getByText('Ничего не найдено')).toBeTruthy());
});
