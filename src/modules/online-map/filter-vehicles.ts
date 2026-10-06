import type { OnlineMapFilter, OnlineMapVehicle } from './types';

const gpsStatusByFilter: Readonly<Record<Exclude<OnlineMapFilter, 'all'>, string>> = {
  'in-park': 'IN_PARK',
  moving: 'MOVING',
  idle: 'IDLE',
  offline: 'STALE',
  'no-data': 'NO_DATA',
};

function normalizeSearchValue(value: string) {
  return value.toLocaleLowerCase('ru-RU').replace(/\s/g, '');
}

export function filterOnlineMapVehicles(
  vehicles: readonly OnlineMapVehicle[],
  query: string,
  filter: OnlineMapFilter,
) {
  const normalizedQuery = normalizeSearchValue(query);

  return vehicles.filter(
    (vehicle) =>
      (filter === 'all' || vehicle.gpsStatus.key === gpsStatusByFilter[filter]) &&
      (!normalizedQuery ||
        normalizeSearchValue(
          `${vehicle.name}${vehicle.plate}${vehicle.currentRental?.clientName ?? ''}${vehicle.currentRental?.contractNumber ?? ''}`,
        ).includes(normalizedQuery)),
  );
}
