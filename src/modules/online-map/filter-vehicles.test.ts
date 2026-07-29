import { describe, expect, it } from 'vitest';

import { onlineMapVehicles } from './fixtures';
import { filterOnlineMapVehicles } from './filter-vehicles';

describe('filterOnlineMapVehicles', () => {
  it('находит автомобиль по госномеру без учёта пробелов и регистра', () => {
    expect(filterOnlineMapVehicles(onlineMapVehicles, 'а123мр77', 'all')).toHaveLength(1);
  });

  it('оставляет только автомобили в движении', () => {
    expect(
      filterOnlineMapVehicles(onlineMapVehicles, '', 'moving').every(
        (vehicle) => vehicle.status === 'moving',
      ),
    ).toBe(true);
  });
});
