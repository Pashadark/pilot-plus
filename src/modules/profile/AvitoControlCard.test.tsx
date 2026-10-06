// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AvitoControlCard } from './AvitoControlCard';
import { updateAvitoProfileControl } from './avito-actions';
vi.mock('./avito-actions', () => ({ updateAvitoProfileControl: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('keeps the switch off on save failure', async () => {
  vi.mocked(updateAvitoProfileControl).mockResolvedValue({
    ok: false,
    message: 'Ошибка сохранения',
  });
  render(<AvitoControlCard initial={{ enabled: false, enabledAt: null, updatedAt: null }} />);
  expect(screen.getByTestId('avito-switch-track').className).toContain('h-6 w-11');
  fireEvent.click(screen.getByRole('switch'));
  await screen.findByRole('alert');
  expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
});
it('shows the server-confirmed state after enabling', async () => {
  vi.mocked(updateAvitoProfileControl).mockResolvedValue({
    ok: true,
    state: { enabled: true, enabledAt: '2026-09-24T12:00:00Z', updatedAt: '2026-09-24T12:00:00Z' },
  });
  render(<AvitoControlCard initial={{ enabled: false, enabledAt: null, updatedAt: null }} />);
  fireEvent.click(screen.getByRole('switch'));
  await waitFor(() => expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true'));
  expect(updateAvitoProfileControl).toHaveBeenCalledWith(true);
});
