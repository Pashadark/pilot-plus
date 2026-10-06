// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

const actionMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());

vi.mock('../actions', () => ({ archiveVehicleAction: actionMock }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, refresh: refreshMock }),
}));
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import { ArchiveVehiclePanel } from './ArchiveVehiclePanel';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('показывает подтверждение и отправляет tenant-scoped архивирование', async () => {
  const user = userEvent.setup();
  actionMock.mockResolvedValue({ ok: true, vehicleId: 'vehicle-1' });

  render(
    <ArchiveVehiclePanel
      companyId="company-1"
      vehicleId="vehicle-1"
      vehicleLabel="Kia K5 · В342НР797"
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Убрать из автопарка' }));
  const dialog = screen.getByRole('dialog');
  expect(dialog).toBeTruthy();
  expect(within(dialog).getByText(/история аренд, ремонтов и штрафов сохранится/i)).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Подтвердить' }));

  expect(actionMock).toHaveBeenCalled();
  const submitted = actionMock.mock.calls[0]?.[1] as FormData;
  expect(submitted.get('companyId')).toBe('company-1');
  expect(submitted.get('vehicleId')).toBe('vehicle-1');

  await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/vehicles'));
  expect(pushMock).not.toHaveBeenCalled();
  expect(refreshMock).not.toHaveBeenCalled();
});
