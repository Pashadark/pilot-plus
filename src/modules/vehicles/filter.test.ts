import { describe, expect, it } from 'vitest';

import { filterVehicles, initialVehicleFilters } from './filter';
import type { VehicleCardDto } from './types';

function vehicle(overrides: Partial<VehicleCardDto>): VehicleCardDto {
  return {
    id: 'vehicle',
    internalNumber: 'PLT-001',
    model: 'GWM WEY',
    city: 'Красноярск',
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
    status: 'UNKNOWN',
    telemetry: {
      odometerKm: null,
      fuelLevelPercent: null,
      lastSeenAt: null,
      lastTripAt: null,
      hasPosition: false,
    },
    ...overrides,
  };
}

const vehicles = [
  vehicle({ id: '1' }),
  vehicle({ id: '2', model: 'Toyota Yaris', city: 'Пхукет', fuelType: 'PETROL', seats: 5 }),
  vehicle({
    id: '3',
    model: 'Hyundai Staria',
    city: 'Владивосток',
    office: 'Аэропорт',
    fuelType: 'DIESEL',
    seats: 9,
    status: 'OFFLINE',
  }),
];

describe('фильтрация автопарка', () => {
  it('ищет без учёта регистра по модели, городу, офису и номеру', () => {
    expect(filterVehicles(vehicles, { ...initialVehicleFilters, query: 'yArIs' })).toHaveLength(1);
    expect(filterVehicles(vehicles, { ...initialVehicleFilters, query: 'аэропорт' })).toHaveLength(1);
    expect(filterVehicles(vehicles, { ...initialVehicleFilters, query: 'PLT-001' })).toHaveLength(3);
  });

  it('комбинирует город, топливо, статус и количество мест', () => {
    const result = filterVehicles(vehicles, {
      query: '',
      city: 'Владивосток',
      fuelType: 'DIESEL',
      status: 'OFFLINE',
      seats: '9',
    });

    expect(result.map((item) => item.id)).toEqual(['3']);
  });
});
