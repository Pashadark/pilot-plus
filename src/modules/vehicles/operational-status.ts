import type { VehicleGpsStatusKey } from './gps-status';

export type VehicleOperationalStatus = 'IN_SERVICE' | 'RENTED' | 'IN_PARK' | 'AVAILABLE';

export function deriveVehicleOperationalStatus(input: {
  hasConfirmedServiceVisit: boolean;
  hasOpenMaintenance: boolean;
  hasActiveRental: boolean;
  gpsStatus: VehicleGpsStatusKey;
}): VehicleOperationalStatus {
  if (input.hasConfirmedServiceVisit || input.hasOpenMaintenance) return 'IN_SERVICE';
  if (input.hasActiveRental) return 'RENTED';
  if (input.gpsStatus === 'IN_PARK') return 'IN_PARK';
  return 'AVAILABLE';
}
