import 'server-only';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';

import { requireVehicleManagementAccess } from './access';

interface VehicleManagementRepository {
  findMany(args: unknown): Promise<unknown[]>;
}

const vehicleManagementSelect = {
  id: true,
  internalNumber: true,
  make: true,
  modelName: true,
  registrationNumber: true,
  manufacturedYear: true,
  odometerKm: true,
  valueMinor: true,
  dailyPriceMinor: true,
  rangePriceMinor: true,
  depositMinor: true,
  city: true,
  isRentalReady: true,
  status: true,
  archivedAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleSelect;

type RawVehicleManagement = {
  id: string;
  internalNumber: string;
  make: string | null;
  modelName: string | null;
  registrationNumber: string | null;
  manufacturedYear: number | null;
  odometerKm: { toString(): string } | null;
  valueMinor: bigint | null;
  dailyPriceMinor: number;
  rangePriceMinor: bigint | null;
  depositMinor: bigint | null;
  city: string;
  isRentalReady: boolean;
  status: 'MOVING' | 'IDLE' | 'OFFLINE' | 'MAINTENANCE' | 'UNKNOWN';
  archivedAt: Date | null;
  updatedAt: Date;
};

export interface ManagedVehicleDto {
  id: string;
  internalNumber: string;
  make: string | null;
  modelName: string | null;
  registrationNumber: string | null;
  manufacturedYear: number | null;
  odometerKm: number | null;
  valueMinor: string | null;
  dailyPriceMinor: number;
  rangePriceMinor: string | null;
  depositMinor: string | null;
  city: string;
  isRentalReady: boolean;
  status: RawVehicleManagement['status'];
  archivedAt: string | null;
  updatedAt: string;
}

function mapVehicle(vehicle: RawVehicleManagement): ManagedVehicleDto {
  return {
    ...vehicle,
    odometerKm: vehicle.odometerKm === null ? null : Number(vehicle.odometerKm.toString()),
    valueMinor: vehicle.valueMinor?.toString() ?? null,
    rangePriceMinor: vehicle.rangePriceMinor?.toString() ?? null,
    depositMinor: vehicle.depositMinor?.toString() ?? null,
    archivedAt: vehicle.archivedAt?.toISOString() ?? null,
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}

export function createVehicleManagementQueries(repository: VehicleManagementRepository) {
  return {
    async listForCompany(companyId: string, includeArchived = false): Promise<ManagedVehicleDto[]> {
      const vehicles = await repository.findMany({
        where: { companyId, ...(includeArchived ? {} : { archivedAt: null }) },
        select: vehicleManagementSelect,
        orderBy: [{ archivedAt: 'asc' }, { internalNumber: 'asc' }],
      });
      return (vehicles as RawVehicleManagement[]).map(mapVehicle);
    },
  };
}

const queries = createVehicleManagementQueries({
  findMany: (args) => prisma.vehicle.findMany(args as Prisma.VehicleFindManyArgs),
});

export async function listManagedVehicles(companyId: string, includeArchived = false) {
  await requireVehicleManagementAccess(companyId);
  return queries.listForCompany(companyId, includeArchived);
}
