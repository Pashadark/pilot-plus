import type { OnlineMapFilter, OnlineMapVehicle } from './types';

function normalizePlate(value: string) {
  return value.toLocaleLowerCase('ru-RU').replace(/\s/g, '');
}

export function filterOnlineMapVehicles(
  vehicles: readonly OnlineMapVehicle[],
  query: string,
  filter: OnlineMapFilter,
) {
  const normalizedQuery = normalizePlate(query);

  return vehicles.filter(
    (vehicle) =>
      (filter === 'all' || vehicle.status === filter) &&
      (!normalizedQuery || normalizePlate(vehicle.plate).includes(normalizedQuery)),
  );
}
