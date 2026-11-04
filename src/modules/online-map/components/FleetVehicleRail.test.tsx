// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import type { OnlineMapVehicle } from '../types';
import { FleetVehicleRail } from './FleetVehicleRail';

afterEach(cleanup);

const vehicles: OnlineMapVehicle[] = [
  {
    id: 'vehicle-1',
    name: 'Kia K5',
    plate: 'В342НР797',
    gpsStatus: { key: 'MOVING', label: 'В движении', tone: 'primary', isConnected: true },
    longitude: 37.62,
    latitude: 55.75,
    speedKph: 64,
    fuelPercent: 52,
    odometerKm: 1262.5,
    dailyDistanceKm: 50.3,
    includedMileageKm: 400,
    maintenance: {
      startOdometerKm: 1000,
      targetOdometerKm: 2000,
      remainingKm: 737.5,
    },
    lastSeenLabel: '2 минуты назад',
    address: 'Москва',
    currentRental: null,
  },
  {
    id: 'vehicle-2',
    name: 'Toyota Camry',
    plate: 'Х069АЕ997',
    gpsStatus: { key: 'NO_DATA', label: 'Нет связи', tone: 'danger', isConnected: false },
    longitude: null,
    latitude: null,
    speedKph: 0,
    fuelPercent: null,
    includedMileageKm: 400,
    lastSeenLabel: 'сигнал ещё не получен',
    address: 'Нет данных GLONASSSoft',
    currentRental: {
      id: 'rental-1',
      contractNumber: 'ME-2026-0030-GA',
      clientName: 'Горбунов Артём Денисович',
      dailyMileageLimitKm: 200,
      totalMileageLimitKm: 800,
      billableDays: 4,
    },
  },
];

function renderRail(overrides: Partial<Parameters<typeof FleetVehicleRail>[0]> = {}) {
  return render(
    <FleetVehicleRail
      vehicles={vehicles}
      selectedVehicleId="vehicle-1"
      query=""
      filter="all"
      collapsed={false}
      onSelect={vi.fn()}
      onQueryChange={vi.fn()}
      onFilterChange={vi.fn()}
      onCollapsedChange={vi.fn()}
      {...overrides}
    />,
  );
}

it('показывает удобный список машин и честный статус водителя', () => {
  renderRail({ selectedDayDistanceKm: 18.6, selectedDayDistanceLoading: false });

  expect(screen.getByRole('searchbox', { name: 'Поиск автомобиля' })).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Выбрать Kia K5 В342НР797' }).getAttribute('aria-current'),
  ).toBe('true');
  expect(screen.getByText('Нет активного водителя')).toBeTruthy();
  expect(screen.getByText('Горбунов Артём Денисович')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Выбрать Kia K5 В342НР797' }).textContent).toContain(
    'За день 18,6 км',
  );
  expect(screen.getByText('До ТО 738 км')).toBeTruthy();
  expect(screen.getByText('Нет активной аренды')).toBeTruthy();
  expect(screen.getByRole('progressbar', { name: 'Пробег до ТО Kia K5' })).toBeTruthy();
  expect(screen.getByRole('progressbar', { name: 'Дневной лимит пробега Kia K5' })).toBeTruthy();
  expect(screen.queryByText('52%')).toBeNull();
});

it('не выдумывает прогресс, когда телеметрии и плана ТО нет', () => {
  renderRail({ selectedVehicleId: 'vehicle-2' });

  const card = screen.getByRole('button', { name: 'Выбрать Toyota Camry Х069АЕ997' });
  expect(card.textContent).toContain('Нет данных по ТО');
  expect(card.textContent).toContain('Лимит 800 км');
  expect(card.textContent).not.toContain('Сегодня 200 км');
  expect(card.textContent).not.toContain('Договор 800 км');
});

it('отдельно предупреждает о просроченном ТО', () => {
  renderRail({
    vehicles: [
      {
        ...vehicles[0],
        maintenance: { ...vehicles[0].maintenance!, status: 'OVERDUE' },
      },
    ],
  });

  expect(screen.getByText('ТО просрочено')).toBeTruthy();
});

it('честно показывает загрузку и отсутствие маршрута выбранного дня', () => {
  const { rerender } = renderRail({
    selectedDayDistanceKm: null,
    selectedDayDistanceLoading: true,
  });

  expect(screen.getByText('Считаем…')).toBeTruthy();

  rerender(
    <FleetVehicleRail
      vehicles={vehicles}
      selectedVehicleId="vehicle-1"
      query=""
      filter="all"
      collapsed={false}
      selectedDayDistanceKm={null}
      selectedDayDistanceLoading={false}
      onSelect={vi.fn()}
      onQueryChange={vi.fn()}
      onFilterChange={vi.fn()}
      onCollapsedChange={vi.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'Выбрать Kia K5 В342НР797' }).textContent).toContain(
    'За день Нет данных',
  );
});

it('передаёт поиск, фильтр и выбор машины без координат', async () => {
  const user = userEvent.setup();
  const onQueryChange = vi.fn();
  const onFilterChange = vi.fn();
  const onSelect = vi.fn();
  renderRail({ onQueryChange, onFilterChange, onSelect });

  await user.type(screen.getByRole('searchbox', { name: 'Поиск автомобиля' }), 'горбунов');
  await user.click(screen.getByRole('button', { name: 'Нет связи' }));
  await user.click(screen.getByRole('button', { name: 'Выбрать Toyota Camry Х069АЕ997' }));

  expect(onQueryChange).toHaveBeenCalled();
  expect(onFilterChange).toHaveBeenCalledWith('no-data');
  expect(onSelect).toHaveBeenCalledWith(vehicles[1]);
});

it('сворачивается в компактную полосу', async () => {
  const user = userEvent.setup();
  const onCollapsedChange = vi.fn();
  renderRail({ onCollapsedChange });

  await user.click(screen.getByRole('button', { name: 'Свернуть список автомобилей' }));
  expect(onCollapsedChange).toHaveBeenCalledWith(true);
});
