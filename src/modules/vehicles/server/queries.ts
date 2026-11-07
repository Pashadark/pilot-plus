import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';

import type { VehicleCardDto, VehicleDetailDto, VehicleOptionDto } from '../types';
import { deriveVehicleGpsStatus } from '../gps-status';
import { getEffectiveMaintenanceStatus } from '@/modules/maintenance/effective-status';
import { latestFuelLevelPercent } from '../current-fuel';
import { driveTypeFromFeatures, fuelConsumptionFromFeatures } from '../technical-features';
import { deriveVehicleOperationalStatus } from '../operational-status';

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
  manufacturedYear: number | null;
  engineLiters: unknown | null;
  fuelType: VehicleCardDto['fuelType'];
  seats: number;
  dailyPriceMinor: number;
  currency: string;
  odometerKm: unknown | null;
  engineHours?: unknown | null;
  originalPrice: string;
  features: string[];
  status: VehicleCardDto['status'];
  createdAt: Date;
  positions: {
    speedKph: number | null;
    odometerKm: unknown | null;
    fuelLevelPercent: unknown | null;
    recordedAt: Date;
    address: string | null;
  }[];
  rentalOperations: {
    mileageKm: unknown | null;
    fuelLevelPercent: unknown | null;
    occurredAt: Date;
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
    levelPercent?: unknown | null;
    consumption?: unknown | null;
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
    recordType: VehicleDetailDto['maintenanceRecords'][number]['recordType'];
    description: string | null;
    kind: VehicleDetailDto['maintenanceRecords'][number]['kind'];
    status: VehicleDetailDto['maintenanceRecords'][number]['status'];
    scheduledAt: Date | null;
    damageReportedAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    targetOdometerKm: unknown | null;
    provider: string | null;
    costMinor: number | null;
    rental: { id: string; contractNumber: string | null } | null;
    client: { id: string; firstName: string; middleName: string | null; lastName: string } | null;
    workItems: {
      id: string;
      title: string;
      description: string | null;
      costMinor: number | null;
    }[];
    attachments: {
      id: string;
      kind: 'DAMAGE_BEFORE' | 'REPAIR_AFTER' | 'DOCUMENT' | 'RECEIPT';
      originalName: string;
      verifiedMime: string;
    }[];
  }[];
  serviceVisits: {
    confirmedAt: Date;
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
    originalName: string | null;
    storageKey: string | null;
  }[];
  rentals?: Array<{
    id: string;
    contractNumber: string | null;
    status: 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    startsAt: Date;
    endsAt: Date;
    client: { id: string; firstName: string; middleName: string | null; lastName: string };
    drivers?: Array<{
      id: string;
      client: { firstName: string; middleName: string | null; lastName: string } | null;
    }>;
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
  | 'manufacturedYear'
  | 'engineLiters'
  | 'fuelType'
  | 'seats'
  | 'dailyPriceMinor'
  | 'currency'
  | 'odometerKm'
  | 'engineHours'
  | 'originalPrice'
  | 'features'
  | 'status'
  | 'positions'
  | 'rentalOperations'
  | 'trips'
  | 'fuelRecords'
  | 'maintenanceRecords'
  | 'serviceVisits'
  | 'images'
>;

type RawRankedVehicleCard = RawVehicleCard & {
  _count?: { rentals: number };
  rentals?: Array<{
    id?: string;
    status?: 'CONFIRMED' | 'ACTIVE' | 'COMPLETED';
    createdAt: Date;
    startsAt?: Date;
    endsAt?: Date;
    contractNumber?: string | null;
    client?: { firstName: string; middleName: string | null; lastName: string };
  }>;
};

const popularityRentalStatuses: ('CONFIRMED' | 'ACTIVE' | 'COMPLETED')[] = [
  'CONFIRMED',
  'ACTIVE',
  'COMPLETED',
];

const vehicleCardSelect = {
  id: true,
  internalNumber: true,
  model: true,
  city: true,
  office: true,
  registrationNumber: true,
  transmission: true,
  manufacturedYear: true,
  engineLiters: true,
  fuelType: true,
  seats: true,
  dailyPriceMinor: true,
  currency: true,
  odometerKm: true,
  engineHours: true,
  originalPrice: true,
  features: true,
  status: true,
  positions: {
    where: { provider: 'GLONASSSOFT' },
    select: {
      odometerKm: true,
      fuelLevelPercent: true,
      speedKph: true,
      recordedAt: true,
      address: true,
    },
    orderBy: { recordedAt: 'desc' as const },
    take: 1,
  },
  rentalOperations: {
    where: {
      status: 'COMMITTED',
      type: { in: ['HANDOVER', 'RETURN'] as const },
    },
    select: {
      mileageKm: true,
      fuelLevelPercent: true,
      occurredAt: true,
    },
    orderBy: [{ occurredAt: 'desc' as const }, { id: 'desc' as const }],
    take: 1,
  },
  trips: {
    select: { startedAt: true },
    orderBy: { startedAt: 'desc' as const },
    take: 1,
  },
  fuelRecords: {
    where: {
      OR: [{ levelPercent: { not: null } }, { consumption: { not: null } }],
    },
    select: { recordedAt: true, levelPercent: true, consumption: true },
    orderBy: { recordedAt: 'desc' as const },
    take: 20,
  },
  maintenanceRecords: {
    where: { status: { in: ['IN_PROGRESS', 'WAITING_REPAIR', 'DAMAGE_REPORTED'] as const } },
    select: { id: true, status: true },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
  serviceVisits: {
    where: { confirmedAt: { not: null }, exitedAt: null },
    select: { confirmedAt: true },
    orderBy: { confirmedAt: 'desc' as const },
    take: 1,
  },
  images: {
    where: { isPrimary: true },
    select: { localPath: true, alt: true },
    orderBy: { position: 'asc' as const },
    take: 1,
  },
  _count: {
    select: { rentals: { where: { status: { in: popularityRentalStatuses } } } },
  },
  rentals: {
    where: { status: { in: popularityRentalStatuses } },
    select: {
      id: true,
      status: true,
      createdAt: true,
      startsAt: true,
      endsAt: true,
      contractNumber: true,
      client: { select: { firstName: true, middleName: true, lastName: true } },
    },
    orderBy: [{ createdAt: 'desc' as const }, { id: 'asc' as const }],
    take: 100,
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
  manufacturedYear: true,
  engineLiters: true,
  fuelType: true,
  seats: true,
  dailyPriceMinor: true,
  currency: true,
  odometerKm: true,
  engineHours: true,
  originalPrice: true,
  features: true,
  status: true,
  createdAt: true,
  positions: {
    where: { provider: 'GLONASSSOFT' },
    select: {
      odometerKm: true,
      fuelLevelPercent: true,
      speedKph: true,
      recordedAt: true,
      address: true,
    },
    orderBy: { recordedAt: 'desc' as const },
    take: 1,
  },
  rentalOperations: {
    where: {
      status: 'COMMITTED',
      type: { in: ['HANDOVER', 'RETURN'] as const },
    },
    select: {
      mileageKm: true,
      fuelLevelPercent: true,
      occurredAt: true,
    },
    orderBy: [{ occurredAt: 'desc' as const }, { id: 'desc' as const }],
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
    select: {
      id: true,
      recordedAt: true,
      volumeLiters: true,
      levelPercent: true,
      consumption: true,
    },
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
      recordType: true,
      description: true,
      kind: true,
      status: true,
      scheduledAt: true,
      damageReportedAt: true,
      startedAt: true,
      completedAt: true,
      targetOdometerKm: true,
      provider: true,
      costMinor: true,
      rental: { select: { id: true, contractNumber: true } },
      client: { select: { id: true, firstName: true, middleName: true, lastName: true } },
      workItems: {
        orderBy: { position: 'asc' as const },
        select: { id: true, title: true, description: true, costMinor: true },
      },
      attachments: {
        orderBy: { createdAt: 'asc' as const },
        select: { id: true, kind: true, originalName: true, verifiedMime: true },
      },
    },
    orderBy: { createdAt: 'desc' as const },
    take: 50,
  },
  serviceVisits: {
    where: { confirmedAt: { not: null }, exitedAt: null },
    select: { confirmedAt: true },
    orderBy: { confirmedAt: 'desc' as const },
    take: 1,
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
    select: {
      id: true,
      title: true,
      type: true,
      expiresAt: true,
      originalName: true,
      storageKey: true,
    },
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
      drivers: {
        select: {
          id: true,
          client: { select: { firstName: true, middleName: true, lastName: true } },
        },
        orderBy: { sortOrder: 'asc' as const },
      },
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
    select: { localPath: true, alt: true },
    orderBy: [{ isPrimary: 'desc' as const }, { position: 'asc' as const }],
    take: 6,
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

function currentOdometerKm(...readings: Array<unknown | null | undefined>) {
  const values = readings
    .map(optionalNumber)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  return values[0] ?? null;
}

function mapCard(
  vehicle: RawRankedVehicleCard,
  referenceTime: Date,
  popularityRank: 1 | 2 | 3 | null = null,
): VehicleCardDto {
  const position = vehicle.positions[0];
  const operationalReading = vehicle.rentalOperations[0];
  const manualFuelReading = vehicle.fuelRecords.find((record) => record.levelPercent != null);
  const consumptionReading = vehicle.fuelRecords.find((record) => record.consumption != null);
  const trip = vehicle.trips[0];
  const activeRental = vehicle.rentals?.find((rental) => rental.status === 'ACTIVE');
  const gpsStatus = deriveVehicleGpsStatus(
    {
      recordedAt: position?.recordedAt,
      speedKph: position?.speedKph,
      address: position?.address,
      hasCoordinates: Boolean(position),
    },
    referenceTime,
  );
  return {
    id: vehicle.id,
    internalNumber: vehicle.internalNumber,
    model: vehicle.model,
    city: vehicle.city,
    office: vehicle.office,
    registrationNumber: vehicle.registrationNumber,
    transmission: vehicle.transmission,
    manufacturedYear: vehicle.manufacturedYear,
    engineLiters: optionalNumber(vehicle.engineLiters),
    driveType: driveTypeFromFeatures(vehicle.features),
    fuelConsumptionLitersPer100Km:
      fuelConsumptionFromFeatures(vehicle.features) ??
      optionalNumber(consumptionReading?.consumption),
    fuelType: vehicle.fuelType,
    seats: vehicle.seats,
    dailyPriceMinor: vehicle.dailyPriceMinor,
    currency: vehicle.currency.trim(),
    originalPrice: vehicle.originalPrice,
    features: vehicle.features,
    status: vehicle.status,
    operationalStatus: deriveVehicleOperationalStatus({
      hasConfirmedServiceVisit: Boolean(vehicle.serviceVisits?.[0]?.confirmedAt),
      hasOpenMaintenance:
        vehicle.status === 'MAINTENANCE' ||
        (vehicle.maintenanceRecords ?? []).some((record) =>
          ['IN_PROGRESS', 'WAITING_REPAIR', 'DAMAGE_REPORTED'].includes(record.status),
        ),
      hasActiveRental: Boolean(activeRental),
      gpsStatus: gpsStatus.key,
    }),
    gpsStatus,
    primaryImage: vehicle.images[0] ?? null,
    activeRental:
      activeRental?.id && activeRental.endsAt && activeRental.client
        ? {
            id: activeRental.id,
            contractNumber: activeRental.contractNumber ?? null,
            clientName: [
              activeRental.client.lastName,
              activeRental.client.firstName,
              activeRental.client.middleName,
            ]
              .filter(Boolean)
              .join(' '),
            endsAt: activeRental.endsAt.toISOString(),
          }
        : null,
    telemetry: {
      odometerKm: currentOdometerKm(
        vehicle.odometerKm,
        position?.odometerKm,
        operationalReading?.mileageKm,
      ),
      engineHours: optionalNumber(vehicle.engineHours),
      fuelLevelPercent: latestFuelLevelPercent(
        { value: position?.fuelLevelPercent, recordedAt: position?.recordedAt },
        {
          value: operationalReading?.fuelLevelPercent,
          recordedAt: operationalReading?.occurredAt,
        },
        { value: manualFuelReading?.levelPercent, recordedAt: manualFuelReading?.recordedAt },
      ),
      speedKph: position?.speedKph ?? null,
      lastSeenAt: position?.recordedAt.toISOString() ?? null,
      lastTripAt: trip?.startedAt.toISOString() ?? null,
      hasPosition: Boolean(position),
      address: position?.address ?? null,
    },
    popularityRank,
  };
}

function rankPopularVehicles(vehicles: RawRankedVehicleCard[]) {
  return vehicles
    .filter((vehicle) => (vehicle._count?.rentals ?? 0) > 0)
    .toSorted((left, right) => {
      const countDifference = (right._count?.rentals ?? 0) - (left._count?.rentals ?? 0);
      if (countDifference !== 0) return countDifference;

      const leftNewest = left.rentals?.[0]?.createdAt.getTime() ?? 0;
      const rightNewest = right.rentals?.[0]?.createdAt.getTime() ?? 0;
      if (leftNewest !== rightNewest) return rightNewest - leftNewest;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    })
    .slice(0, 3);
}

function mapRankedCards(vehicles: RawRankedVehicleCard[], referenceTime: Date) {
  const ranked = rankPopularVehicles(vehicles);
  const rankByVehicleId = new Map(
    ranked.map((vehicle, index) => [vehicle.id, (index + 1) as 1 | 2 | 3]),
  );

  return vehicles.map((vehicle) =>
    mapCard(vehicle, referenceTime, rankByVehicleId.get(vehicle.id) ?? null),
  );
}

function getPopularityRank(vehicles: RawRankedVehicleCard[], vehicleId: string) {
  const ranked = rankPopularVehicles(vehicles);
  const index = ranked.findIndex((vehicle) => vehicle.id === vehicleId);
  return index === -1 ? null : ((index + 1) as 1 | 2 | 3);
}

function mapDetail(
  vehicle: RawVehicle,
  referenceTime: Date,
  popularityRank: 1 | 2 | 3 | null = null,
): VehicleDetailDto {
  const currentRental = vehicle.rentals?.find(
    (rental) => rental.status === 'ACTIVE' && rental.startsAt <= referenceTime,
  );
  return {
    ...mapCard(vehicle as RawRankedVehicleCard, referenceTime, popularityRank),
    vin: vehicle.vin,
    createdAt: vehicle.createdAt.toISOString(),
    currentRentalId: currentRental?.id ?? null,
    galleryImages: vehicle.images,
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
      recordType: record.recordType ?? 'MAINTENANCE',
      description: record.description ?? null,
      status: getEffectiveMaintenanceStatus(record.status, record.scheduledAt, referenceTime),
      scheduledAt: record.scheduledAt?.toISOString() ?? null,
      damageReportedAt: record.damageReportedAt?.toISOString() ?? null,
      startedAt: record.startedAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
      targetOdometerKm: optionalNumber(record.targetOdometerKm),
      rental: record.rental ?? null,
      client: record.client
        ? {
            id: record.client.id,
            fullName: [record.client.lastName, record.client.firstName, record.client.middleName]
              .filter(Boolean)
              .join(' '),
          }
        : null,
      workItems: record.workItems ?? [],
      attachments: (record.attachments ?? []).map((attachment) => ({
        id: attachment.id,
        kind: attachment.kind,
        originalName: attachment.originalName,
        url: `/maintenance/${record.id}/attachments/${attachment.id}`,
        isImage: attachment.verifiedMime.startsWith('image/'),
      })),
    })),
    washRecords: vehicle.washRecords.map((record) => ({
      ...record,
      scheduledAt: record.scheduledAt.toISOString(),
      startedAt: record.startedAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
    })),
    documents: vehicle.documents.map((document) => ({
      id: document.id,
      title: document.title,
      type: document.type,
      originalName: document.originalName,
      hasFile: Boolean(document.storageKey),
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
      drivers: (rental.drivers ?? [])
        .filter((driver) => driver.client)
        .map((driver) => ({
          id: driver.id,
          fullName: [driver.client?.lastName, driver.client?.firstName, driver.client?.middleName]
            .filter(Boolean)
            .join(' '),
        })),
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
    async listVehiclesForUser(userId: string, referenceTime = new Date()) {
      const vehicles = await repository.findMany({
        where: { archivedAt: null, company: { members: { some: { userId } } } },
        select: vehicleCardSelect,
        orderBy: [{ city: 'asc' }, { model: 'asc' }, { internalNumber: 'asc' }],
      });
      return mapRankedCards(vehicles as RawRankedVehicleCard[], referenceTime);
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
      if (!vehicle) return null;
      const rankedVehicles = await repository.findMany({
        where: { archivedAt: null, company: { members: { some: { userId } } } },
        select: {
          id: true,
          _count: {
            select: { rentals: { where: { status: { in: popularityRentalStatuses } } } },
          },
          rentals: {
            where: { status: { in: popularityRentalStatuses } },
            select: { createdAt: true },
            orderBy: [{ createdAt: 'desc' as const }, { id: 'asc' as const }],
            take: 1,
          },
        },
      });
      const popularityRank = getPopularityRank(rankedVehicles as RawRankedVehicleCard[], vehicleId);
      return mapDetail(vehicle as RawVehicle, referenceTime, popularityRank);
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
