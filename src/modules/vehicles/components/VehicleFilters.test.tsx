// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { initialVehicleFilters } from '../filter';
import type { VehicleCardDto } from '../types';
import { VehicleFilters } from './VehicleFilters';

afterEach(cleanup);

const vehicle: VehicleCardDto = {
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
  gpsStatus: { key: 'IN_PARK', label: 'В парке', tone: 'success', isConnected: true },
  primaryImage: null,
  telemetry: {
    odometerKm: null,
    fuelLevelPercent: null,
    lastSeenAt: null,
    lastTripAt: null,
    hasPosition: false,
    address: null,
  },
};

describe('VehicleFilters', () => {
  it('предлагает отдельный доступный фильтр «Где машина» для GPS-состояния', () => {
    const onChange = vi.fn();

    render(
      <VehicleFilters
        filters={initialVehicleFilters}
        vehicles={[vehicle]}
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );

    const gpsFilter = screen.getByLabelText('Где машина');
    expect(gpsFilter.tagName).toBe('SELECT');
    expect(screen.getByLabelText('Статус').tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'В парке' }).getAttribute('value')).toBe('IN_PARK');
    expect(screen.getByRole('option', { name: 'Давно не обновлялся' }).getAttribute('value')).toBe(
      'STALE',
    );
    expect(screen.getByRole('option', { name: 'Нет связи' }).getAttribute('value')).toBe('NO_DATA');

    fireEvent.change(gpsFilter, { target: { value: 'MOVING' } });
    expect(onChange).toHaveBeenCalledWith({ ...initialVehicleFilters, gpsStatus: 'MOVING' });
  });
});
