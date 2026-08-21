import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';

import type { VehicleCardDto, VehicleDetailDto, VehicleOptionDto } from '../types';
import { getEffectiveMaintenanceStatus } from '@/modules/maintenance/effective-status';

interface VehicleRepository {
  findMany(args: unknown): Promise<unknown[]>;
  findFirst(args: unknown): Promise<unknown | null>;
}

interface RawVehicle {
  id: string;
  internalNumber: string;
  model: string;
  city: string;
  office: string | null;
  registrationNumber: string | null;
  vin: string | null;
  transmission: string;
  engineLiters: unknown | null;
  fuelType: VehicleCardDto['fuelType'];
  seats: number;
  dailyPriceMinor: number;
  currency: string;
  originalPrice: string;
  features: string[];
  status: VehicleCardDto['status'];
  createdAt: Date;
  positions: {
    odometerKm: unknown | null;
    fuelLevelPercent: unknown | null;
    recordedAt: Date;
    address: string | null;
  }[];
  trips: {
    id?: string;
    startedAt: Date;
    endedAt?: Date | null;
    distanceKm?: unknown | null;
    durationSeconds?: number | null;
  }[];
  fuelRecords: {
    id?: string;
    recordedAt: Date;
    volumeLiters?: unknown | null;
  }[];
  events: {
    id: string;
    title: string;
    severity: 'INFO' | 'WARNING' | 'DANGER';
    description: string | null;
    recordedAt: Date;
  }[];
  maintenanceRecords: {
    id: string;
    title: string;
    kind: VehicleDetailDto['maintenanceRecords'][number]['kind'];
    status: VehicleDetailDto['maintenanceRecords'][number]['status'];
    scheduledAt: Date | null;
    completedAt: Date | null;
    targetOdometerKm: unknown | null;
    provider: string | null;
    costMinor: number | null;
  }[];
  washRecords: {
    id: string;
    kind: VehicleDetailDto['washRecords'][number]['kind'];
    status: VehicleDetailDto['washRecords'][number]['status'];
    scheduledAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    provider: string | null;
    costMinor: number | null;
  }[];
  documents: {
    id: string;
    title: string;
    type: string;
    expiresAt: Date | null;
  }[];
  rentals?: Array<{
    id: string;
    contractNumber: string | null;
    status: 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    startsAt: Date;
    endsAt: Date;
    client: { id: string; firstName: string; middleName: string | null; lastName: string };
    documentVersions: { id: string; version: number; format: 'DOCX' | 'PDF' }[];
    operations: Array<{
      id: string;
      type: 'HANDOVER' | 'EXTENSION' | 'RETURN';
      occurredAt: Date;
      mileageKm: number | null;
      fuelLevelPercent: number | null;
      evidenceStatus: 'COMPLETE' | 'VIDEO_MISSING' | 'DASHBOARD_PHOTO_MISSING' | 'MISSING';
    }>;
  }>;
  images: {
    localPath: string;
    alt: string;
  }[];
}

type RawVehicleCard = Pick<
  RawVehicle,
  | 'id'
  | 'internalNumber'
  | 'model'
  | 'city'
  | 'office'
  | 'registrationNumber'
  | 'transmission'
  | 'engineLiters'
  | 'fuelType'
  | 'seats'
  | 'dailyPriceMinor'
  | 'currency'
  | 'originalPrice'
  | 'features'
  | 'status'
  | 'positions'
  | 'trips'
  | 'images'
>;

const vehicleCardSelect = {
  id: true,
  internalNumber: true,
  model: true,
  city: true,
  office: true,
  registrationNumber: true,
  transmission: true,
  engineLiters: true,
  fuelType: true,
  seats: true,
  dailyPriceMinor: true,
  currency: true,
  originalPrice: true,
  features: true,
  status: true,
  positions: {
    select: { odometerKm: true, fuelLevelPercent: true, recordedAt: true, address: true },
    orderBy: { recordedAt: 'desc' as const },
    take: 1,
  },
  trips: {
    select: { startedAt: true },
    orderBy: { startedAt: 'desc' as const },
    take: 1,
  },
  images: {
    where: { isPrimary: true },
    select: { localPath: true, alt: true },
    orderBy: { position: 'asc' as const },
    take: 1,
  },
} satisfies Prisma.VehicleSelect;

const vehicleDetailSelect = {
  id: true,
  internalNumber: true,
  model: true,
  city: true,
  office: true,
  registrationNumber: true,
  vin: true,
  transmission: true,
  engineLiters: true,
  fuelType: true,
  seats: true,
  dailyPriceMinor: true,
  currency: true,
  originalPrice: true,
  features: true,
  status: true,
  createdAt: true,
  positions: {
    select: { odometerKm: true, fuelLevelPercent: true, recordedAt: true, address: true },
    orderBy: { recordedAt: 'desc' as const },
    take: 1,
  },
  trips: {
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      distanceKm: true,
      durationSeconds: true,
    },
    orderBy: { startedAt: 'desc' as const },
    take: 50,
  },
  fuelRecords: {
    select: { id: true, recordedAt: true, volumeLiters: true },
    orderBy: { recordedAt: 'desc' as const },
    take: 50,
  },
  events: {
    select: { id: true, title: true, severity: true, description: true, recordedAt: true },
    orderBy: { recordedAt: 'desc' as const },
    take: 50,
  },
  maintenanceRecords: {
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      scheduledAt: true,
      completedAt: true,
      targetOdometerKm: true,
      provider: true,
      costMinor: true,
    },
    orderBy: { createdAt: 'desc' as const },
    take: 50,
  },
  washRecords: {
    select: {
      id: true,
      kind: true,
      status: true,
      scheduledAt: true,
      startedAt: true,
      completedAt: true,
      provider: true,
      costMinor: true,
    },
    orderBy: { scheduledAt: 'desc' as const },
    take: 50,
  },
  documents: {
    select: { id: true, title: true, type: true, expiresAt: true },
    orderBy: { createdAt: 'desc' as const },
    take: 50,
  },
  rentals: {
    select: {
      id: true,
      contractNumber: true,
      status: true,
      startsAt: true,
      endsAt: true,
      client: { select: { id: true, firstName: true, middleName: true, lastName: true } },
      documentVersions: {
        select: { id: true, version: true, format: true },
        orderBy: [{ version: 'desc' as const }, { format: 'asc' as const }],
      },
      operations: {
        where: { status: 'COMMITTED' },
        select: {
          id: true,
          type: true,
          occurredAt: true,
          mileageKm: true,
          fuelLevelPercent: true,
          evidenceStatus: true,
        },
        orderBy: [{ occurredAt: 'desc' as const }, { id: 'desc' as const }],
        take: 50,
      },
    },
    orderBy: { startsAt: 'desc' as const },
    take: 100,
  },
  images: {
    where: { isPrimary: true },
    select: { localPath: true, alt: true },
    orderBy: { position: 'asc' as const },
    take: 1,
  },
} satisfies Prisma.VehicleSelect;

const vehicleOptionSelect = {
  id: true,
  internalNumber: true,
  model: true,
  registrationNumber: true,
  images: {
    where: { isPrimary: true },
    select: { localPath: true, alt: true },
    orderBy: { position: 'asc' as const },
    take: 1,
  },
} satisfies Prisma.VehicleSelect;

type RawVehicleOption = {
  id: string;
  internalNumber: string;
  model: string;
  registrationNumber: string | null;
  images: VehicleOptionDto['image'][];
};

function optionalNumber(value: unknown | null | undefined) {
  return value === null || value === undefined ? null : Number(value);
}

function mapCard(vehicle: RawVehicleCard): VehicleCardDto {
  const position = vehicle.positions[0];
  const trip = vehicle.trips[0];
  return {
    id: vehicle.id,
    internalNumber: vehicle.internalNumber,
    model: vehicle.model,
    city: vehicle.city,
    office: vehicle.office,
    registrationNumber: vehicle.registrationNumber,
    transmission: vehicle.transmission,
    engineLiters: optionalNumber(vehicle.engineLiters),
    fuelType: vehicle.fuelType,
    seats: vehicle.seats,
    dailyPriceMinor: vehicle.dailyPriceMinor,
    currency: vehicle.currency.trim(),
    originalPrice: vehicle.originalPrice,
    features: vehicle.features,
    status: vehicle.status,
    primaryImage: vehicle.images[0] ?? null,
    telemetry: {
      odometerKm: optionalNumber(position?.odometerKm),
      fuelLevelPercent: optionalNumber(position?.fuelLevelPercent),
      lastSeenAt: position?.recordedAt.toISOString() ?? null,
      lastTripAt: trip?.startedAt.toISOString() ?? null,
      hasPosition: Boolean(position),
      address: position?.address ?? null,
    },
  };
}

function mapDetail(vehicle: RawVehicle, referenceTime: Date): VehicleDetailDto {
  return {
    ...mapCard(vehicle),
    vin: vehicle.vin,
    createdAt: vehicle.createdAt.toISOString(),
    trips: vehicle.trips.map((trip) => ({
      id: trip.id ?? `${vehicle.id}-${trip.startedAt.toISOString()}`,
      startedAt: trip.startedAt.toISOString(),
      endedAt: trip.endedAt?.toISOString() ?? null,
      distanceKm: optionalNumber(trip.distanceKm),
      durationSeconds: trip.durationSeconds ?? null,
    })),
    events: vehicle.events.map((event) => ({
      ...event,
      recordedAt: event.recordedAt.toISOString(),
    })),
    fuelRecords: vehicle.fuelRecords.map((record) => ({
      id: record.id ?? `${vehicle.id}-${record.recordedAt.toISOString()}`,
      recordedAt: record.recordedAt.toISOString(),
      volumeLiters: optionalNumber(record.volumeLiters),
    })),
    maintenanceRecords: vehicle.maintenanceRecords.map((record) => ({
      ...record,
      status: getEffectiveMaintenanceStatus(record.status, record.scheduledAt, referenceTime),
      scheduledAt: record.scheduledAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
      targetOdometerKm: optionalNumber(record.targetOdometerKm),
    })),
    washRecords: vehicle.washRecords.map((record) => ({
      ...record,
      scheduledAt: record.scheduledAt.toISOString(),
      startedAt: record.startedAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
    })),
    documents: vehicle.documents.map((document) => ({
      ...document,
      expiresAt: document.expiresAt?.toISOString() ?? null,
    })),
    rentals: (vehicle.rentals ?? []).map((rental) => ({
      id: rental.id,
      contractNumber: rental.contractNumber,
      status: rental.status,
      startsAt: rental.startsAt.toISOString(),
      endsAt: rental.endsAt.toISOString(),
      client: {
        id: rental.client.id,
        fullName: [rental.client.lastName, rental.client.firstName, rental.client.middleName]
          .filter(Boolean)
          .join(' '),
      },
      documents: rental.documentVersions,
      operations: rental.operations.map((operation) => ({
        ...operation,
        occurredAt: operation.occurredAt.toISOString(),
      })),
    })),
  };
}

export function createVehicleQueries(repository: VehicleRepository) {
  return {
    async listVehiclesForUser(userId: string) {
      const vehicles = await repository.findMany({
        where: { archivedAt: null, company: { members: { some: { userId } } } },
        select: vehicleCardSelect,
        orderBy: [{ city: 'asc' }, { model: 'asc' }, { internalNumber: 'asc' }],
      });
      return (vehicles as RawVehicleCard[]).map(mapCard);
    },
    async listVehicleOptionsForUser(userId: string): Promise<VehicleOptionDto[]> {
      const vehicles = await repository.findMany({
        where: { archivedAt: null, company: { members: { some: { userId } } } },
        select: vehicleOptionSelect,
        orderBy: [{ model: 'asc' }, { internalNumber: 'asc' }],
      });

      return (vehicles as RawVehicleOption[]).map((vehicle) => ({
        id: vehicle.id,
        label: [vehicle.internalNumber, vehicle.model, vehicle.registrationNumber]
          .filter(Boolean)
          .join(' · '),
        image: vehicle.images[0] ?? null,
      }));
    },
    async getVehicleForUser(userId: string, vehicleId: string, referenceTime = new Date()) {
      const vehicle = await repository.findFirst({
        where: {
          id: vehicleId,
          archivedAt: null,
          company: { members: { some: { userId } } },
        },
        select: vehicleDetailSelect,
      });
      return vehicle ? mapDetail(vehicle as RawVehicle, referenceTime) : null;
    },
  };
}

const queries = createVehicleQueries({
  findMany: (args) => prisma.vehicle.findMany(args as Prisma.VehicleFindManyArgs),
  findFirst: (args) => prisma.vehicle.findFirst(args as Prisma.VehicleFindFirstArgs),
});

export const listVehiclesForUser = queries.listVehiclesForUser;
export const listVehicleOptionsForUser = queries.listVehicleOptionsForUser;
export const getVehicleForUser = queries.getVehicleForUser;
