import type { VehicleCardDto, VehicleFuelType, VehicleStatus } from './types';
import type { VehicleGpsStatusKey } from './gps-status';

export interface VehicleFilters {
  query: string;
  city: string;
  fuelType: VehicleFuelType | '';
  status: VehicleStatus | '';
  gpsStatus: VehicleGpsStatusKey | '';
  seats: string;
}

export const initialVehicleFilters: VehicleFilters = {
  query: '',
  city: '',
  fuelType: '',
  status: '',
  gpsStatus: '',
  seats: '',
};

export function filterVehicles(vehicles: readonly VehicleCardDto[], filters: VehicleFilters) {
  const query = filters.query.trim().toLocaleLowerCase('ru-RU');

  return vehicles.filter((vehicle) => {
    const searchable = [
      vehicle.model,
      vehicle.city,
      vehicle.office,
      vehicle.internalNumber,
      vehicle.registrationNumber,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('ru-RU');

    return (
      (!query || searchable.includes(query)) &&
      (!filters.city || vehicle.city === filters.city) &&
      (!filters.fuelType || vehicle.fuelType === filters.fuelType) &&
      (!filters.status || vehicle.status === filters.status) &&
      (!filters.gpsStatus || vehicle.gpsStatus.key === filters.gpsStatus) &&
      (!filters.seats || vehicle.seats === Number(filters.seats))
    );
  });
}
