import type { FleetDatabase } from './actions';
import type { ExistingFleetRow } from './fleet-reconciliation';

type VehicleWithReferences = {
  id: string;
  registrationNumberNormalized: string | null;
  make: string | null;
  modelName: string | null;
  isDemoImport: boolean;
  device: { id: string } | null;
  _count: Record<string, number>;
};

const countedRelations = [
  'positions',
  'trips',
  'events',
  'fuelRecords',
  'maintenanceRecords',
  'washRecords',
  'documents',
  'images',
  'manualVehicleEvents',
  'rentals',
  'botRentalRequests',
  'externalFineLinks',
  'fines',
] as const;

export async function loadExistingFleetRows(
  database: FleetDatabase,
  companyId: string,
): Promise<ExistingFleetRow[]> {
  const rows = (await database.vehicle.findMany({
    where: { companyId, archivedAt: null },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      registrationNumberNormalized: true,
      make: true,
      modelName: true,
      isDemoImport: true,
      device: { select: { id: true } },
      _count: { select: Object.fromEntries(countedRelations.map((relation) => [relation, true])) },
    },
  })) as VehicleWithReferences[];

  return rows.map((row) => ({
    id: row.id,
    plate: row.registrationNumberNormalized,
    make: row.make,
    model: row.modelName,
    isDemoImport: row.isDemoImport,
    references:
      countedRelations.reduce((total, relation) => total + (row._count[relation] ?? 0), 0) +
      (row.device ? 1 : 0),
  }));
}
