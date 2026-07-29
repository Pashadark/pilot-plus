import type { OnlineMapFilter, OnlineMapVehicle } from './types';

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
      (filter === 'all' || vehicle.status === filter) &&
      (!normalizedQuery ||
        normalizeSearchValue(`${vehicle.name}${vehicle.plate}`).includes(normalizedQuery)),
  );
}
