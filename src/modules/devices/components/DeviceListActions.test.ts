// @vitest-environment jsdom

import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const routerMocks = vi.hoisted(() => ({ refresh: vi.fn() }));
const showToastMock = vi.hoisted(() => vi.fn());
const createCommandMock = vi.hoisted(() => vi.fn());
const bindDeviceMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => routerMocks }));
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: showToastMock }),
}));
vi.mock('../actions', () => ({
  createDeviceCommandAction: createCommandMock,
  bindDeviceAction: bindDeviceMock,
}));

import { DeviceCard } from './DeviceCard';
import { DeviceListActions } from './DeviceListActions';

const device = {
  id: 'device-1',
  name: 'Pilot Connect 0147',
  serialNumber: 'PC-0147-001',
  imei: '123456789012345',
  hardwareVersion: '2.1.0',
  firmwareVersion: '3.4.0',
  status: 'ONLINE',
  effectiveStatus: 'ONLINE',
  connectionType: 'LTE',
  mobileOperator: 'МТС',
  signalStrength: 92,
  satellitesCount: 14,
  powerSource: 'VEHICLE',
  externalVoltage: 12.6,
  batteryLevel: 88,
  lastSeenAt: '2026-07-27T09:30:00.000Z',
  vehicle: { id: 'vehicle-1', label: 'PLT-001 · Geely Coolray', registrationNumber: 'А123ВС 77' },
  updateAvailable: true,
  hasActiveCommand: false,
} as const;

const firmwareReleases = [
  {
    id: 'firmware-1',
    version: '3.5.0',
    channel: 'STABLE',
    releaseNotes: 'Стабильная версия.',
    isRequired: false,
    releasedAt: '2026-07-20T00:00:00.000Z',
    createdAt: '2026-07-20T00:00:00.000Z',
  },
] as const;

describe('действия в списке устройств', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('открывает рабочие команды, обновление и изменение привязки', async () => {
    createCommandMock.mockResolvedValue({ success: true, message: 'Команда добавлена в очередь.' });
    bindDeviceMock.mockResolvedValue({
      success: true,
      message: 'Автомобиль привязан к устройству.',
    });
    render(
      createElement(DeviceListActions, {
        device,
        firmwareReleases,
        availableVehicles: [{ id: 'vehicle-2', label: 'PLT-002 · Haval Jolion' }],
      }),
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Действия устройства Pilot Connect 0147' })[0],
    );
    expect(screen.getByText('Открыть устройство')).not.toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Перезагрузить' }));
    expect(screen.getByRole('dialog').textContent).toContain('Перезагрузить устройство');
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить перезагрузку' }));
    await waitFor(() => expect(createCommandMock).toHaveBeenCalledTimes(1));
    expect(showToastMock).toHaveBeenCalledWith({
      tone: 'success',
      title: 'Команда добавлена в очередь.',
    });
    expect(routerMocks.refresh).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Действия устройства Pilot Connect 0147' })[0],
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Обновить прошивку' }));
    expect(screen.getByRole('dialog').textContent).toContain('Обновить прошивку');

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Действия устройства Pilot Connect 0147' })[0],
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Изменить привязку' }));
    fireEvent.change(screen.getByLabelText('Автомобиль'), { target: { value: 'vehicle-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить привязку' }));
    await waitFor(() => expect(bindDeviceMock).toHaveBeenCalledTimes(1));
  });

  it('блокирует конфликтующие команды и показывает напряжение в мобильной карточке', () => {
    render(
      createElement(
        'div',
        null,
        createElement(DeviceListActions, {
          device: { ...device, hasActiveCommand: true },
          firmwareReleases,
          availableVehicles: [],
        }),
        createElement(DeviceCard, {
          device,
          firmwareReleases,
          availableVehicles: [],
        }),
      ),
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Действия устройства Pilot Connect 0147' })[0],
    );
    expect(screen.getByText('Команда ожидает отправки')).not.toBeNull();
    expect(screen.getByTestId('device-mobile-card').textContent).toContain('12,6 В');
  });

  it('оставляет диалог открытым и показывает один error-toast при ошибке команды', async () => {
    createCommandMock.mockResolvedValue({
      success: false,
      message: 'Для устройства уже выполняется команда.',
    });
    render(
      createElement(DeviceListActions, {
        device,
        firmwareReleases,
        availableVehicles: [],
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Действия устройства Pilot Connect 0147' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Перезагрузить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить перезагрузку' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('уже выполняется'));
    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledWith({
      tone: 'danger',
      title: 'Для устройства уже выполняется команда.',
    });
  });
});
