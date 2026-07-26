// @vitest-environment jsdom

import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const successState = {
  status: 'success' as const,
  message: 'Мойка запланирована.',
};
const createWashActionMock = vi.hoisted(() => vi.fn());

vi.mock('../actions', () => ({
  createWashAction: createWashActionMock,
}));

import { WashForm } from './WashForm';

const vehicles = [{ id: 'vehicle-1', label: 'PLT-001 · GWM WEY', image: null }] as const;

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/Автомобиль/), {
    target: { value: 'vehicle-1' },
  });
  fireEvent.change(screen.getByLabelText(/Тип мойки/), {
    target: { value: 'COMPLEX' },
  });
  fireEvent.change(screen.getByLabelText(/Плановая дата/), {
    target: { value: '2026-07-27T10:00' },
  });
}

async function submitWash(expectedActionCalls: number) {
  fillRequiredFields();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить мойку' }));
  await waitFor(() => expect(createWashActionMock).toHaveBeenCalledTimes(expectedActionCalls));
}

describe('жизненный цикл формы мойки', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('завершает каждую из последовательных отправок с одинаковым success-ответом', async () => {
    createWashActionMock.mockResolvedValue(successState);
    const onSuccess = vi.fn();

    render(
      createElement(WashForm, {
        vehicles,
        onCancel: vi.fn(),
        onSuccess,
      }),
    );

    await submitWash(1);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    await submitWash(2);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(2));
  });

  it('оставляет форму открытой и не завершает workspace lifecycle при ошибке', async () => {
    createWashActionMock.mockResolvedValue({
      status: 'error',
      message: 'Не удалось сохранить мойку.',
    });
    const onSuccess = vi.fn();

    render(
      createElement(WashForm, {
        vehicles,
        onCancel: vi.fn(),
        onSuccess,
      }),
    );

    await submitWash(1);
    await screen.findByRole('alert');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
