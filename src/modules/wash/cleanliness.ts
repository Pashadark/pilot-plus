export const CLEAN_WASH_WINDOW_DAYS = 7;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type VehicleCleanlinessStatus = 'CLEAN' | 'NEEDS_WASH';

type VehicleIdentity = { id: string };
type WashCompletion = {
  vehicleId: string;
  status: string;
  completedAt: string | null;
};

export type VehicleCleanliness = {
  vehicleId: string;
  status: VehicleCleanlinessStatus;
  lastCompletedAt: string | null;
};

export type FleetCleanliness = {
  vehicles: VehicleCleanliness[];
  needsWashCount: number;
};

export function calculateFleetCleanliness(
  vehicles: readonly VehicleIdentity[],
  records: readonly WashCompletion[],
  referenceTime: Date,
): FleetCleanliness {
  const latestCompletionByVehicle = new Map<string, number>();

  for (const record of records) {
    if (record.status !== 'COMPLETED' || !record.completedAt) continue;
    const completedAt = new Date(record.completedAt).getTime();
    if (!Number.isFinite(completedAt)) continue;
    const previous = latestCompletionByVehicle.get(record.vehicleId);
    if (previous === undefined || completedAt > previous) {
      latestCompletionByVehicle.set(record.vehicleId, completedAt);
    }
  }

  const cleanSince = referenceTime.getTime() - CLEAN_WASH_WINDOW_DAYS * DAY_IN_MS;
  const vehicleCleanliness = vehicles.map((vehicle): VehicleCleanliness => {
    const completedAt = latestCompletionByVehicle.get(vehicle.id);
    return {
      vehicleId: vehicle.id,
      status: completedAt !== undefined && completedAt >= cleanSince ? 'CLEAN' : 'NEEDS_WASH',
      lastCompletedAt: completedAt === undefined ? null : new Date(completedAt).toISOString(),
    };
  });

  return {
    vehicles: vehicleCleanliness,
    needsWashCount: vehicleCleanliness.filter((vehicle) => vehicle.status === 'NEEDS_WASH').length,
  };
}
