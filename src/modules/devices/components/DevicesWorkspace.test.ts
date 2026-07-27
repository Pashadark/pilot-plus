// @vitest-environment jsdom

import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));
const showToastMock = vi.hoisted(() => vi.fn());
let currentSearchParams = 'status=OFFLINE&source=alert';

vi.mock('next/navigation', () => ({
  usePathname: () => '/devices',
  useRouter: () => routerMocks,
  useSearchParams: () => new URLSearchParams(currentSearchParams),
}));
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: showToastMock }),
}));
vi.mock('./DeviceForm', async () => {
  const { createElement: createMockElement } = await import('react');
  return {
    DeviceForm: ({ onSuccess }: { onSuccess: (message: string) => void }) =>
      createMockElement(
        'button',
        { type: 'button', onClick: () => onSuccess('Устройство добавлено.') },
        'Завершить добавление устройства',
      ),
  };
});

import { DevicesWorkspace } from './DevicesWorkspace';

const devices = [
  {
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
    batteryLevel: 88,
    lastSeenAt: '2026-07-27T09:30:00.000Z',
    vehicle: {
      id: 'vehicle-1',
      label: 'PLT-001 · Geely Coolray · А123ВС 77',
      registrationNumber: 'А123ВС 77',
    },
    updateAvailable: true,
  },
  {
    id: 'device-2',
    name: 'Pilot Connect 0148',
    serialNumber: 'PC-0148-001',
    imei: '987654321098765',
    hardwareVersion: '2.1.0',
    firmwareVersion: '3.2.0',
    status: 'OFFLINE',
    effectiveStatus: 'OFFLINE',
    connectionType: 'NONE',
    mobileOperator: null,
    signalStrength: null,
    satellitesCount: 0,
    powerSource: 'BATTERY',
    batteryLevel: 46,
    lastSeenAt: null,
    vehicle: null,
    updateAvailable: false,
  },
] as const;

const props = {
  devices,
  firmwareReleases: [
    {
      id: 'firmware-1',
      version: '3.4.0',
      channel: 'STABLE',
      releaseNotes: 'Стабильная версия.',
      isRequired: false,
      releasedAt: '2026-07-20T00:00:00.000Z',
      createdAt: '2026-07-20T00:00:00.000Z',
    },
  ],
  availableVehicles: [{ id: 'vehicle-2', label: 'PLT-002 · Haval Jolion' }],
  summary: { total: 2, online: 1, offline: 1, updateAvailable: 1 },
} as const;

describe('workspace устройств Pilot Connect', () => {
  afterEach(() => {
    cleanup();
    currentSearchParams = 'status=OFFLINE&source=alert';
    vi.clearAllMocks();
  });

  it('показывает сводку, оба адаптивных представления и применяет фильтры из URL', () => {
    render(createElement(DevicesWorkspace, props));

    expect(screen.getByTestId('devices-total-stat').textContent).toContain('2');
    expect(screen.getByTestId('devices-online-stat').textContent).toContain('1');
    expect(screen.getByTestId('devices-offline-stat').textContent).toContain('1');
    expect(screen.getByTestId('devices-update-stat').textContent).toContain('1');
    expect(screen.getByTestId('devices-table').className).toContain('md:block');
    expect(screen.getByTestId('devices-mobile-list').className).toContain('md:hidden');
    expect(screen.queryByText('Pilot Connect 0147')).toBeNull();
    expect(screen.getAllByText('Pilot Connect 0148')).not.toHaveLength(0);
  });

  it('ищет по серийному номеру, IMEI, автомобилю и сохраняет посторонние query-параметры', () => {
    currentSearchParams = 'source=alert';
    render(createElement(DevicesWorkspace, props));

    const search = screen.getByLabelText('Поиск устройств') as HTMLInputElement;
    fireEvent.change(search, { target: { value: '123456789012345' } });
    expect(screen.getAllByText('Pilot Connect 0147')).not.toHaveLength(0);
    fireEvent.change(search, { target: { value: 'А123ВС' } });
    expect(screen.getAllByText('Pilot Connect 0147')).not.toHaveLength(0);
    fireEvent.change(search, { target: { value: 'PC-0148' } });
    expect(screen.getAllByText('Pilot Connect 0148')).not.toHaveLength(0);
    expect(routerMocks.replace).toHaveBeenLastCalledWith(expect.stringContaining('source=alert'), {
      scroll: false,
    });
  });

  it('фильтрует по статусу, питанию, обновлению и привязке', () => {
    currentSearchParams = '';
    render(createElement(DevicesWorkspace, props));

    fireEvent.change(screen.getByLabelText('Статус'), { target: { value: 'ONLINE' } });
    expect(screen.getAllByText('Pilot Connect 0147')).not.toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Питание'), { target: { value: 'BATTERY' } });
    expect(screen.getAllByText('Устройства не найдены')).not.toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Статус'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Обновление'), { target: { value: 'current' } });
    expect(screen.getAllByText('Pilot Connect 0148')).not.toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Привязка'), { target: { value: 'free' } });
    expect(screen.getAllByText('Pilot Connect 0148')).not.toHaveLength(0);
  });

  it('на каждый success показывает один toast, закрывает диалог и обновляет серверные данные', async () => {
    render(createElement(DevicesWorkspace, props));

    fireEvent.click(screen.getByRole('button', { name: 'Добавить устройство' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Завершить добавление устройства' }));
    await waitFor(() => expect(dialog.isConnected).toBe(false));

    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledWith({ tone: 'success', title: 'Устройство добавлено.' });
    expect(routerMocks.refresh).toHaveBeenCalledTimes(1);
  });
});
