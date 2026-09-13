// @vitest-environment jsdom

import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const createRepairActionMock = vi.hoisted(() => vi.fn());

vi.mock('../actions', () => ({
  createRepairAction: createRepairActionMock,
}));

import { RepairForm } from './RepairForm';

const vehicles = [
  { id: 'vehicle-1', label: 'CAR-001 · Toyota Camry · Х069АЕ997', image: null },
] as const;
const rentals = [
  {
    id: 'rental-1',
    vehicleId: 'vehicle-1',
    label: 'ME-2026-0030-GA · Горбунов Артём Денисович',
  },
] as const;

describe('форма ремонта', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('показывает связь с арендой, виды работ и необязательные группы файлов', () => {
    render(
      createElement(RepairForm, {
        vehicles,
        rentals,
        initialVehicleId: 'vehicle-1',
        onCancel: vi.fn(),
        onSuccess: vi.fn(),
      }),
    );

    expect((screen.getByLabelText(/Связанный договор/) as HTMLSelectElement).value).toBe('');
    expect(screen.getByRole('option', { name: /ME-2026-0030-GA/ })).toBeTruthy();
    expect((screen.getByLabelText('Фото повреждений') as HTMLInputElement).required).toBe(false);
    expect((screen.getByLabelText('Фото после ремонта') as HTMLInputElement).required).toBe(false);
    expect((screen.getByLabelText('Документы и заказ-наряды') as HTMLInputElement).required).toBe(
      false,
    );
    expect(screen.getByRole('button', { name: 'Добавить вид работ' })).toBeTruthy();
  });

  it('отправляет ремонт и завершает форму после success', async () => {
    createRepairActionMock.mockResolvedValue({ status: 'success', message: 'Ремонт добавлен.' });
    const onSuccess = vi.fn();
    render(
      createElement(RepairForm, {
        vehicles,
        rentals,
        initialVehicleId: 'vehicle-1',
        onCancel: vi.fn(),
        onSuccess,
      }),
    );

    fireEvent.change(screen.getByLabelText(/Название ремонта/), {
      target: { value: 'Повреждение заднего бампера' },
    });
    fireEvent.change(screen.getByLabelText(/Дата повреждения/), {
      target: { value: '2026-09-12T12:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить ремонт' }));

    await waitFor(() => expect(createRepairActionMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('Ремонт добавлен.'));
  });
});
