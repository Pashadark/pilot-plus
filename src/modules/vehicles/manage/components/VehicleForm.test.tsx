// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../actions', () => ({ createVehicleAction: vi.fn(), updateVehicleAction: vi.fn() }));
vi.mock('@/shared/providers/ToastProvider', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { VehicleForm } from './VehicleForm';

afterEach(cleanup);

describe('VehicleForm', () => {
  it('renders Russian labelled inputs and a 44px save action', () => {
    render(<VehicleForm companies={[{ id: 'company-1', label: 'Компания', canArchive: true }]} />);

    expect(document.querySelector('input[name="make"]')).toBeTruthy();
    expect(document.querySelector('input[name="registrationNumber"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Сохранить автомобиль' }).className).toContain(
      'min-h-11',
    );
  });

  it('shows a company selector rather than silently choosing among several companies', () => {
    render(
      <VehicleForm
        companies={[
          { id: 'company-1', label: 'Первая компания', canArchive: true },
          { id: 'company-2', label: 'Вторая компания', canArchive: false },
        ]}
      />,
    );

    expect(document.querySelector('select[name="companyId"]')).toBeTruthy();
  });

  it('renders existing values and submits the vehicle id in edit mode', () => {
    render(
      <VehicleForm
        companies={[{ id: 'company-1', label: 'Компания', canArchive: true }]}
        vehicle={{
          id: 'vehicle-1',
          companyId: 'company-1',
          internalNumber: 'ПАРК-01',
          registrationNumber: 'А429АУ997',
          make: 'Kia',
          model: "Cee'd",
          year: 2020,
          vin: 'XWEH4816BL0002046',
          city: 'Москва',
          dailyPriceRubles: '3350',
          transmission: 'Автомат',
          fuelType: 'PETROL',
          driveType: 'FRONT',
          fuelConsumptionLitersPer100Km: '7.2',
          seats: 5,
          status: 'IDLE',
          isRentalReady: false,
          fuelLevelPercent: 55,
        }}
      />,
    );

    expect(document.querySelector('input[name="vehicleId"]')?.getAttribute('value')).toBe(
      'vehicle-1',
    );
    expect((document.querySelector('input[name="make"]') as HTMLInputElement).value).toBe('Kia');
    expect(document.querySelector('input[name="registrationCertificateNumber"]')).toBeTruthy();
    expect(document.querySelector('input[name="osagoPolicyNumber"]')).toBeTruthy();
    expect(document.querySelector('input[name="depositRubles"]')).toBeTruthy();
    expect((document.querySelector('select[name="driveType"]') as HTMLSelectElement).value).toBe(
      'FRONT',
    );
    expect(
      (document.querySelector('input[name="fuelConsumptionLitersPer100Km"]') as HTMLInputElement)
        .value,
    ).toBe('7.2');
    expect(
      (document.querySelector('input[name="fuelLevelPercent"]') as HTMLInputElement).value,
    ).toBe('55');
    expect(screen.getByText('Текущий уровень топлива, %')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeTruthy();
  });

  it('does not show the current fuel field while creating a vehicle', () => {
    render(<VehicleForm companies={[{ id: 'company-1', label: 'Компания', canArchive: true }]} />);

    expect(document.querySelector('input[name="fuelLevelPercent"]')).toBeNull();
  });
});
