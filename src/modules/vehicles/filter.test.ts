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
    gpsStatus: { key: 'NO_DATA', label: 'Нет связи', tone: 'danger', isConnected: false },
    primaryImage: null,
    telemetry: {
      odometerKm: null,
      fuelLevelPercent: null,
      lastSeenAt: null,
      lastTripAt: null,
      hasPosition: false,
      address: null,
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
    status: 'MAINTENANCE',
  }),
];

describe('фильтрация автопарка', () => {
  it('ищет без учёта регистра по модели, городу, офису и номеру', () => {
    expect(filterVehicles(vehicles, { ...initialVehicleFilters, query: 'yArIs' })).toHaveLength(1);
    expect(filterVehicles(vehicles, { ...initialVehicleFilters, query: 'аэропорт' })).toHaveLength(
      1,
    );
    expect(filterVehicles(vehicles, { ...initialVehicleFilters, query: 'PLT-001' })).toHaveLength(
      3,
    );
  });

  it('комбинирует город, топливо, статус и количество мест', () => {
    const result = filterVehicles(vehicles, {
      query: '',
      city: 'Владивосток',
      fuelType: 'DIESEL',
      status: 'MAINTENANCE',
      gpsStatus: '',
      seats: '9',
    });

    expect(result.map((item) => item.id)).toEqual(['3']);
  });

  it('отдельно фильтрует автомобили по оперативному GPS-статусу', () => {
    const gpsVehicles = [
      vehicle({
        id: 'park',
        gpsStatus: { key: 'IN_PARK', label: 'В парке', tone: 'success', isConnected: true },
      }),
      vehicle({
        id: 'moving',
        gpsStatus: { key: 'MOVING', label: 'В движении', tone: 'primary', isConnected: true },
      }),
      vehicle({
        id: 'idle',
        gpsStatus: { key: 'IDLE', label: 'Стоит', tone: 'warning', isConnected: true },
      }),
      vehicle({
        id: 'stale',
        gpsStatus: {
          key: 'STALE',
          label: 'Давно не обновлялся',
          tone: 'danger',
          isConnected: false,
        },
      }),
      vehicle({
        id: 'no-data',
        gpsStatus: { key: 'NO_DATA', label: 'Нет связи', tone: 'danger', isConnected: false },
      }),
    ];

    for (const [gpsStatus, id] of [
      ['IN_PARK', 'park'],
      ['MOVING', 'moving'],
      ['IDLE', 'idle'],
      ['STALE', 'stale'],
      ['NO_DATA', 'no-data'],
    ] as const) {
      expect(
        filterVehicles(gpsVehicles, { ...initialVehicleFilters, gpsStatus }).map((item) => item.id),
      ).toEqual([id]);
    }
  });

  it('сохраняет бизнес-статус отдельным от GPS-фильтра', () => {
    const result = filterVehicles(
      [
        vehicle({
          id: 'maintenance-in-park',
          status: 'MAINTENANCE',
          gpsStatus: { key: 'IN_PARK', label: 'В парке', tone: 'success', isConnected: true },
        }),
        vehicle({
          id: 'maintenance-moving',
          status: 'MAINTENANCE',
          gpsStatus: { key: 'MOVING', label: 'В движении', tone: 'primary', isConnected: true },
        }),
      ],
      { ...initialVehicleFilters, status: 'MAINTENANCE', gpsStatus: 'IN_PARK' },
    );

    expect(result.map((item) => item.id)).toEqual(['maintenance-in-park']);
  });
});
