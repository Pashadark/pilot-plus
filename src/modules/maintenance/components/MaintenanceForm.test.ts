// @vitest-environment jsdom

import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const successState = {
  status: 'success' as const,
  message: 'ТО запланировано.',
};
const createMaintenanceActionMock = vi.hoisted(() => vi.fn());

vi.mock('../actions', () => ({
  createMaintenanceAction: createMaintenanceActionMock,
}));

import { MaintenanceForm } from './MaintenanceForm';

const vehicles = [{ id: 'vehicle-1', label: 'PLT-001 · GWM WEY', image: null }] as const;

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/Автомобиль/), {
    target: { value: 'vehicle-1' },
  });
  fireEvent.change(screen.getByLabelText(/Название работы/), {
    target: { value: 'Замена масла' },
  });
  fireEvent.change(screen.getByLabelText(/Вид работы/), {
    target: { value: 'OIL' },
  });
  fireEvent.change(screen.getByLabelText(/Плановая дата/), {
    target: { value: '2026-07-27T10:00' },
  });
}

async function submitMaintenance(expectedActionCalls: number) {
  fillRequiredFields();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить ТО' }));
  await waitFor(() =>
    expect(createMaintenanceActionMock).toHaveBeenCalledTimes(expectedActionCalls),
  );
}

describe('жизненный цикл формы технического обслуживания', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('завершает каждую из последовательных отправок с одинаковым success-ответом', async () => {
    createMaintenanceActionMock.mockResolvedValue(successState);
    const onSuccess = vi.fn();

    render(
      createElement(MaintenanceForm, {
        vehicles,
        onCancel: vi.fn(),
        onSuccess,
      }),
    );

    await submitMaintenance(1);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    await submitMaintenance(2);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(2));
  });
});
