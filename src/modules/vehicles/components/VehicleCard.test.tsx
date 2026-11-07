// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/modules/maintenance/service-plan-actions', () => ({
  readServicePlan: vi.fn().mockResolvedValue({ canEdit: false, current: null, record: null }),
  saveServicePlan: vi.fn(),
}));

import type { VehicleCardDto } from '../types';
import { ToastProvider } from '@/shared/providers/ToastProvider';
import { VehicleCard } from './VehicleCard';

afterEach(cleanup);

it('shows GPS location instead of the assigned office', () => {
  const item = vehicle({ key: 'IDLE', label: 'Стоит', tone: 'warning', isConnected: true });
  item.office = 'Основной автопарк';
  item.telemetry.address = '12 улица Строителей, Петушки';
  render(
    <ToastProvider>
      <VehicleCard vehicle={item} />
    </ToastProvider>,
  );
  expect(screen.getByText('12 улица Строителей, Петушки')).toBeTruthy();
  expect(screen.queryByText('Москва · Основной автопарк')).toBeNull();
});

function vehicle(
  gpsStatus: VehicleCardDto['gpsStatus'],
  status: VehicleCardDto['status'] = 'MAINTENANCE',
): VehicleCardDto {
  return {
    id: 'vehicle-1',
    internalNumber: 'PLT-001',
    model: 'GWM WEY',
    city: 'Москва',
    office: null,
    registrationNumber: null,
    transmission: 'АКПП',
    engineLiters: 1.5,
    manufacturedYear: 2020,
    driveType: 'Передний',
    fuelConsumptionLitersPer100Km: 7.2,
    fuelType: 'PETROL',
    seats: 7,
    dailyPriceMinor: 880000,
    currency: 'RUB',
    originalPrice: '8 800 ₽',
    features: [],
    status,
    operationalStatus: status === 'MAINTENANCE' ? 'IN_SERVICE' : 'AVAILABLE',
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
    ['IN_SERVICE', 'В сервисе', '--color-service'],
    ['RENTED', 'В аренде', '--color-warning'],
    ['IN_PARK', 'В парке', '--color-primary'],
    ['AVAILABLE', 'Свободна', '--color-success'],
  ] as const)(
    'показывает единый операционный статус %s семантическим цветом',
    (key, label, semanticToken) => {
      const item = vehicle({ key: 'IDLE', label: 'Стоит', tone: 'warning', isConnected: true });
      item.operationalStatus = key;

      render(
        <ToastProvider>
          <VehicleCard vehicle={item} />
        </ToastProvider>,
      );

      const badge = screen.getByTestId('vehicle-operational-status');
      expect(badge.textContent).toBe(label);
      expect(badge.className).toContain(semanticToken);
      expect(screen.queryByText('Последний сигнал')).toBeNull();
      expect(screen.queryByText('Последняя поездка')).toBeNull();
      expect(screen.queryByText('Стоит')).toBeNull();
    },
  );

  it('не дублирует технический GPS-статус', () => {
    const moving = {
      key: 'MOVING',
      label: 'В движении',
      tone: 'primary',
      isConnected: true,
    } as const;
    const serviceVehicle = vehicle(moving, 'OFFLINE');
    serviceVehicle.operationalStatus = 'IN_SERVICE';
    const { rerender } = render(
      <ToastProvider>
        <VehicleCard vehicle={serviceVehicle} />
      </ToastProvider>,
    );

    expect(screen.queryByText('Не на связи')).toBeNull();
    expect(screen.queryByText('В движении')).toBeNull();
    expect(screen.getAllByText('В сервисе')).toHaveLength(1);

    rerender(
      <ToastProvider>
        <VehicleCard vehicle={{ ...serviceVehicle, status: 'MAINTENANCE' }} />
      </ToastProvider>,
    );
    expect(screen.getByText('В сервисе')).toBeTruthy();
  });

  it('показывает место популярности на фотографии и не рисует медаль без места', () => {
    const moving = {
      key: 'MOVING',
      label: 'В движении',
      tone: 'primary',
      isConnected: true,
    } as const;
    const popularVehicle = vehicle(moving, 'IDLE');
    popularVehicle.popularityRank = 1;
    const { rerender } = render(
      <ToastProvider>
        <VehicleCard vehicle={popularVehicle} />
      </ToastProvider>,
    );

    expect(screen.getByRole('img', { name: '1 место по количеству заказов' })).toBeTruthy();

    rerender(
      <ToastProvider>
        <VehicleCard vehicle={{ ...popularVehicle, popularityRank: null }} />
      </ToastProvider>,
    );
    expect(screen.queryByRole('img', { name: /место по количеству заказов/ })).toBeNull();
  });

  it('явно показывает текущую аренду, клиента, договор и дату возврата', () => {
    const rentedVehicle = vehicle({
      key: 'MOVING',
      label: 'В движении',
      tone: 'primary',
      isConnected: true,
    });
    rentedVehicle.activeRental = {
      id: 'rental-1',
      contractNumber: 'ME-2026-0042-AA',
      clientName: 'Иванов Иван',
      endsAt: '2026-09-14T10:00:00.000Z',
    };
    rentedVehicle.operationalStatus = 'RENTED';

    render(
      <ToastProvider>
        <VehicleCard vehicle={rentedVehicle} />
      </ToastProvider>,
    );

    expect(screen.getByText('В аренде')).toBeTruthy();
    expect(screen.getByText('Иванов Иван')).toBeTruthy();
    expect(screen.getByText(/ME-2026-0042-AA/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Иванов Иван/ }).getAttribute('href')).toBe(
      '/rentals/rental-1',
    );
  });

  it('повторяет выбранную иерархию: аренда, характеристики и телематика без рекламных опций', () => {
    const rentedVehicle = vehicle({
      key: 'MOVING',
      label: 'В движении',
      tone: 'primary',
      isConnected: true,
    });
    rentedVehicle.registrationNumber = 'А429АУ997';
    rentedVehicle.features = ['Apple CarPlay', 'Android Auto', 'Подогрев сидений'];
    rentedVehicle.activeRental = {
      id: 'rental-1',
      contractNumber: 'ME-2026-0048-DI',
      clientName: 'Даровская Ирина Геннадиевна',
      endsAt: '2026-10-07T11:00:00.000Z',
    };
    rentedVehicle.operationalStatus = 'RENTED';

    render(
      <ToastProvider>
        <VehicleCard vehicle={rentedVehicle} />
      </ToastProvider>,
    );

    const rental = screen.getByTestId('vehicle-active-rental');
    const specifications = screen.getByTestId('vehicle-specifications');
    const telemetry = screen.getByTestId('vehicle-telemetry');

    expect(rental.compareDocumentPosition(specifications) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(
      specifications.compareDocumentPosition(telemetry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(specifications.className).toContain('bg-[var(--color-elevated)]');
    expect(telemetry.className).toContain('bg-[var(--color-elevated)]');
    expect(specifications.className).not.toContain('bg-[#eeeeef]');
    expect(telemetry.className).not.toContain('bg-[#eeeeef]');
    expect(specifications.className).not.toContain('border-y');
    expect(telemetry.className).not.toContain('border');
    expect(screen.getByText('2020')).toBeTruthy();
    expect(screen.getByText('Передний')).toBeTruthy();
    expect(screen.getByText('7,2 л/100 км')).toBeTruthy();
    expect(screen.getByText('Договор')).toBeTruthy();
    expect(screen.getByText('ME-2026-0048-DI')).toBeTruthy();
    expect(screen.getByText('Возврат')).toBeTruthy();
    expect(screen.getByText('07.10.2026')).toBeTruthy();
    expect(screen.getByText('14:00')).toBeTruthy();
    expect(screen.queryByText('Apple CarPlay')).toBeNull();
    expect(screen.queryByText('Android Auto')).toBeNull();
    expect(screen.queryByText('Подогрев сидений')).toBeNull();
    expect(screen.getByText('PLT-001').parentElement?.textContent).not.toContain('·');
  });

  it('показывает статус парка без второго свободного или GPS-бейджа', () => {
    const parked = vehicle(
      {
        key: 'IN_PARK',
        label: 'В парке',
        tone: 'success',
        isConnected: true,
      },
      'IDLE',
    );
    parked.operationalStatus = 'IN_PARK';
    render(
      <ToastProvider>
        <VehicleCard vehicle={parked} />
      </ToastProvider>,
    );

    expect(screen.getByText('В парке')).toBeTruthy();
    expect(screen.queryByText('Свободна')).toBeNull();
  });

  it('показывает топливо компактной шкалой с процентом внутри', () => {
    const currentVehicle = vehicle({
      key: 'IN_PARK',
      label: 'В парке',
      tone: 'success',
      isConnected: true,
    });
    currentVehicle.telemetry.fuelLevelPercent = 55;

    render(
      <ToastProvider>
        <VehicleCard vehicle={currentVehicle} />
      </ToastProvider>,
    );

    const progress = screen.getByRole('progressbar', { name: 'Уровень топлива' });
    expect(progress.getAttribute('aria-valuenow')).toBe('55');
    expect(progress.textContent).toContain('55%');
  });
});
