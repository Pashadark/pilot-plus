// @vitest-environment jsdom

import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('./DeviceMiniMap', () => ({
  DeviceMiniMap: ({ latitude, longitude }: { latitude: number; longitude: number }) =>
    createElement('div', { 'data-testid': 'device-mini-map' }, `${latitude},${longitude}`),
}));

import { DeviceDetailPage } from './DeviceDetailPage';

const device = {
  id: 'device-1',
  name: 'Pilot Connect 0147',
  serialNumber: 'PC-0147-001',
  imei: '123456789012345',
  hardwareVersion: '2.1.0',
  firmwareVersion: '3.4.0',
  status: 'ONLINE',
  effectiveStatus: 'OFFLINE',
  connectionType: 'LTE',
  mobileOperator: 'МТС',
  signalStrength: 92,
  satellitesCount: 14,
  positionAccuracyMeters: 4.5,
  powerSource: 'VEHICLE',
  externalVoltage: 12.6,
  batteryLevel: 88,
  ignitionOn: true,
  isMoving: false,
  latitude: 55.7558,
  longitude: 37.6173,
  lastSeenAt: '2026-07-27T09:30:00.000Z',
  installedAt: '2026-07-01T09:30:00.000Z',
  createdAt: '2026-07-01T09:30:00.000Z',
  updatedAt: '2026-07-27T09:30:00.000Z',
  vehicle: {
    id: 'vehicle-1',
    label: 'PLT-001 · Geely Coolray',
    registrationNumber: 'А123ВС 77',
  },
  updateAvailable: true,
  hasActiveCommand: true,
  availableFirmwareReleases: [
    {
      id: 'firmware-1',
      version: '3.5.0',
      channel: 'STABLE',
      releaseNotes: 'Стабильная версия.',
      isRequired: false,
      releasedAt: '2026-07-20T00:00:00.000Z',
      createdAt: '2026-07-20T00:00:00.000Z',
    },
  ],
  commands: [
    {
      id: 'command-1',
      deviceId: 'device-1',
      type: 'REBOOT',
      status: 'PENDING',
      firmwareReleaseId: null,
      targetFirmwareVersion: null,
      errorMessage: null,
      createdByName: 'Павел Седов',
      createdAt: '2026-07-27T09:00:00.000Z',
      sentAt: null,
      completedAt: null,
      cancelledAt: null,
    },
    {
      id: 'command-2',
      deviceId: 'device-1',
      type: 'UPDATE_FIRMWARE',
      status: 'FAILED',
      firmwareReleaseId: 'firmware-1',
      targetFirmwareVersion: '3.4.0',
      errorMessage: 'Устройство недоступно',
      createdByName: 'Павел Седов',
      createdAt: '2026-07-26T09:00:00.000Z',
      sentAt: '2026-07-26T09:01:00.000Z',
      completedAt: '2026-07-26T09:02:00.000Z',
      cancelledAt: null,
    },
    {
      id: 'command-3',
      deviceId: 'device-1',
      type: 'REBOOT',
      status: 'SENT',
      firmwareReleaseId: null,
      targetFirmwareVersion: null,
      errorMessage: null,
      createdByName: 'Павел Седов',
      createdAt: '2026-07-25T09:00:00.000Z',
      sentAt: '2026-07-25T09:01:00.000Z',
      completedAt: null,
      cancelledAt: null,
    },
    {
      id: 'command-4',
      deviceId: 'device-1',
      type: 'REBOOT',
      status: 'COMPLETED',
      firmwareReleaseId: null,
      targetFirmwareVersion: null,
      errorMessage: null,
      createdByName: 'Павел Седов',
      createdAt: '2026-07-24T09:00:00.000Z',
      sentAt: '2026-07-24T09:01:00.000Z',
      completedAt: '2026-07-24T09:02:00.000Z',
      cancelledAt: null,
    },
    {
      id: 'command-5',
      deviceId: 'device-1',
      type: 'REBOOT',
      status: 'CANCELLED',
      firmwareReleaseId: null,
      targetFirmwareVersion: null,
      errorMessage: null,
      createdByName: 'Павел Седов',
      createdAt: '2026-07-23T09:00:00.000Z',
      sentAt: null,
      completedAt: null,
      cancelledAt: '2026-07-23T09:02:00.000Z',
    },
  ],
} as const;

describe('детальная страница устройства', () => {
  afterEach(cleanup);

  it('показывает идентификацию, автомобиль, связь, питание и актуальный статус', () => {
    render(createElement(DeviceDetailPage, { device, availableVehicles: [] }));

    expect(screen.getByRole('heading', { name: 'Pilot Connect 0147' })).not.toBeNull();
    expect(screen.getByText('Офлайн')).not.toBeNull();
    expect(screen.getAllByText('PC-0147-001')).not.toHaveLength(0);
    expect(screen.getByText('123456789012345')).not.toBeNull();
    expect(screen.getByRole('link', { name: /PLT-001/ }).getAttribute('href')).toBe(
      '/vehicles/vehicle-1',
    );
    expect(screen.getByText('LTE · МТС · 92%')).not.toBeNull();
    expect(screen.getByText('14 · точность 4,5 м')).not.toBeNull();
    expect(screen.getByText('От автомобиля · 12,6 В · 88%')).not.toBeNull();
    expect(screen.getByText('Включено')).not.toBeNull();
    expect(screen.getByText('Нет')).not.toBeNull();
  });

  it('передаёт числовые координаты в мини-карту и показывает только новое обновление', () => {
    render(createElement(DeviceDetailPage, { device, availableVehicles: [] }));

    expect(screen.getByTestId('device-mini-map').textContent).toBe('55.7558,37.6173');
    expect(screen.getByText('Доступно обновление: 3.5.0')).not.toBeNull();
    expect(screen.queryByText('3.4.0 доступно')).toBeNull();
  });

  it('показывает русский журнал команд и блокирует конфликтующие действия', () => {
    render(createElement(DeviceDetailPage, { device, availableVehicles: [] }));

    expect(screen.getByText('Ожидает отправки')).not.toBeNull();
    expect(screen.getByText('Отправлена')).not.toBeNull();
    expect(screen.getByText('Выполнена')).not.toBeNull();
    expect(screen.getByText('Ошибка')).not.toBeNull();
    expect(screen.getByText('Отменена')).not.toBeNull();
    expect(screen.getByText('Устройство недоступно')).not.toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Перезагрузить' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('button', { name: 'Выключить' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: 'Отменить команду' })).not.toBeNull();
  });

  it('заменяет карту заглушкой, если координаты ещё не получены', () => {
    render(
      createElement(DeviceDetailPage, {
        device: { ...device, latitude: null, longitude: null },
        availableVehicles: [],
      }),
    );

    expect(screen.getByText('Координаты ещё не получены')).not.toBeNull();
    expect(screen.queryByTestId('device-mini-map')).toBeNull();
  });
});
