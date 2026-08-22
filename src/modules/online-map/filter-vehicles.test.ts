import { describe, expect, it } from 'vitest';

import { onlineMapVehicles } from './fixtures';
import { filterOnlineMapVehicles } from './filter-vehicles';
import type { OnlineMapVehicle } from './types';

describe('filterOnlineMapVehicles', () => {
  it('находит автомобиль по госномеру без учёта пробелов и регистра', () => {
    expect(filterOnlineMapVehicles(onlineMapVehicles, 'а123мр77', 'all')).toHaveLength(1);
  });

  it('находит автомобиль по модели без учёта пробелов и регистра', () => {
    expect(filterOnlineMapVehicles(onlineMapVehicles, 'GEELYATLAS', 'all')).toEqual([
      expect.objectContaining({ plate: 'Е 789 НО 77' }),
    ]);
  });

  it('оставляет только автомобили в движении', () => {
    expect(
      filterOnlineMapVehicles(onlineMapVehicles, '', 'moving').every(
        (vehicle) => vehicle.gpsStatus.key === 'MOVING',
      ),
    ).toBe(true);
  });

  it('использует те же ключи GPS-статусов, что и фильтр автопарка', () => {
    const vehicles = [
      {
        ...onlineMapVehicles[0],
        gpsStatus: { key: 'IN_PARK', label: 'В парке', tone: 'success', isConnected: true },
      },
      {
        ...onlineMapVehicles[3],
        gpsStatus: {
          key: 'STALE',
          label: 'Давно не обновлялся',
          tone: 'danger',
          isConnected: false,
        },
      },
      {
        ...onlineMapVehicles[1],
        gpsStatus: { key: 'NO_DATA', label: 'Нет связи', tone: 'danger', isConnected: false },
        latitude: null,
        longitude: null,
      },
    ] as unknown as OnlineMapVehicle[];

    expect(filterOnlineMapVehicles(vehicles, '', 'offline')).toEqual([vehicles[1]]);
    expect(filterOnlineMapVehicles(vehicles, '', 'no-data')).toEqual([vehicles[2]]);
  });
});
