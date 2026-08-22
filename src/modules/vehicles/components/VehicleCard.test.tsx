// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { VehicleCardDto } from '../types';
import { ToastProvider } from '@/shared/providers/ToastProvider';
import { VehicleCard } from './VehicleCard';

afterEach(cleanup);

function vehicle(gpsStatus: VehicleCardDto['gpsStatus']): VehicleCardDto {
  return {
    id: 'vehicle-1',
    internalNumber: 'PLT-001',
    model: 'GWM WEY',
    city: 'Москва',
    office: null,
    registrationNumber: null,
    transmission: 'АКПП',
    engineLiters: 1.5,
    fuelType: 'PETROL',
    seats: 7,
    dailyPriceMinor: 880000,
    currency: 'RUB',
    originalPrice: '8 800 ₽',
    features: [],
    status: 'MAINTENANCE',
    gpsStatus,
    primaryImage: null,
    telemetry: {
      odometerKm: null,
      fuelLevelPercent: null,
      lastSeenAt: '2026-08-22T10:30:00.000Z',
      lastTripAt: null,
      hasPosition: true,
      address: 'Москва, Зелёный проспект, 22',
    },
  };
}

describe('VehicleCard', () => {
  it.each([
    ['IN_PARK', 'В парке', '--color-success'],
    ['MOVING', 'В движении', '--color-primary'],
    ['IDLE', 'Стоит', '--color-warning'],
    ['STALE', 'Давно не обновлялся', '--color-danger'],
    ['NO_DATA', 'Нет связи', '--color-danger'],
  ] as const)('показывает GPS-статус %s семантическим цветом', (key, label, semanticToken) => {
    const statuses = {
      IN_PARK: { key: 'IN_PARK', label: 'В парке', tone: 'success', isConnected: true },
      MOVING: { key: 'MOVING', label: 'В движении', tone: 'primary', isConnected: true },
      IDLE: { key: 'IDLE', label: 'Стоит', tone: 'warning', isConnected: true },
      STALE: { key: 'STALE', label: 'Давно не обновлялся', tone: 'danger', isConnected: false },
      NO_DATA: { key: 'NO_DATA', label: 'Нет связи', tone: 'danger', isConnected: false },
    } as const;

    render(
      <ToastProvider>
        <VehicleCard vehicle={vehicle(statuses[key])} />
      </ToastProvider>,
    );

    const badge = screen.getByTestId('vehicle-gps-status');
    expect(badge.textContent).toBe(label);
    expect(badge.className).toContain(semanticToken);
    expect(screen.getByText('Последний сигнал').textContent).toBe('Последний сигнал');
    expect(screen.getByText(/22\.08\.2026/).textContent).toContain('22.08.2026');
  });
});
