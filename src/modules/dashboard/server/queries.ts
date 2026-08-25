import 'server-only';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { hasCompanyPermission } from '@/modules/admin/access/permissions';
import { decryptField } from '@/services/security/field-encryption';
import { getAuthenticatedSession } from '@/services/auth/session';

import { getDashboardWindow, type DashboardPeriod } from '../date-window';
import { buildDashboardOverview } from '../normalizers';
import type { DashboardOverviewDto } from '../overview-types';

type DashboardSession = {
  companyId: string;
  canViewClientPhone: boolean;
};

type DashboardRepository = {
  vehicleFindMany(args: unknown): Promise<unknown[]>;
  rentalFindMany(args: unknown): Promise<unknown[]>;
  maintenanceFindMany(args: unknown): Promise<unknown[]>;
  washFindMany(args: unknown): Promise<unknown[]>;
};

type DashboardQueryDependencies = {
  encryptionKey: string;
};

type RawVehicle = {
  id: string;
  make: string | null;
  model: string;
  registrationNumber: string | null;
  archivedAt: Date | null;
  isDemoImport: boolean;
  positions: Array<{ recordedAt: Date }>;
};

type RawRental = {
  id: string;
  vehicleId: string;
  status: 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startsAt: Date;
  endsAt: Date;
  completedAt: Date | null;
  totalPriceMinor: bigint;
  depositMinor: bigint | null;
  contractNumber: string | null;
  client: {
    firstName: string;
    middleName: string | null;
    lastName: string;
    phoneEncrypted?: string;
  };
  vehicle: { make: string | null; model: string; registrationNumber: string | null };
  operations: Array<{
    id: string;
    type: 'HANDOVER' | 'EXTENSION' | 'RETURN';
    status: 'DRAFT' | 'COMMITTED' | 'ERROR';
    occurredAt: Date;
    depositStatus:
      'NOT_COLLECTED' | 'COLLECTED' | 'RETURNED' | 'PARTIALLY_WITHHELD' | 'WITHHELD' | null;
    fulfillmentMethod: 'OFFICE' | 'DELIVERY' | null;
    fulfillmentAddress: string | null;
    nextEndsAt: Date | null;
    extensionChargeMinor: bigint | null;
  }>;
};

type RawMaintenance = {
  id: string;
  vehicleId: string;
  title: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
  scheduledAt: Date | null;
  scheduledEndsAt: Date | null;
  vehicle: { make: string | null; model: string; registrationNumber: string | null };
};

type RawWash = {
  id: string;
  vehicleId: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  vehicle: { make: string | null; model: string; registrationNumber: string | null };
};

const vehicleSelect = {
  id: true,
  make: true,
  model: true,
  registrationNumber: true,
  archivedAt: true,
  isDemoImport: true,
  positions: {
    where: { provider: 'GLONASSSOFT' },
    select: { recordedAt: true },
    orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
    take: 1,
  },
} satisfies Prisma.VehicleSelect;

const DASHBOARD_RENTAL_OPERATION_LIMIT = 24;

function rentalSelect(canViewClientPhone: boolean) {
  return {
    id: true,
    vehicleId: true,
    status: true,
    startsAt: true,
    endsAt: true,
    completedAt: true,
    totalPriceMinor: true,
    depositMinor: true,
    contractNumber: true,
    client: {
      select: {
        firstName: true,
        middleName: true,
        lastName: true,
        ...(canViewClientPhone ? { phoneEncrypted: true } : {}),
      },
    },
    vehicle: { select: { make: true, model: true, registrationNumber: true } },
    operations: {
      where: { status: 'COMMITTED' },
      select: {
        id: true,
        type: true,
        status: true,
        occurredAt: true,
        depositStatus: true,
        fulfillmentMethod: true,
        fulfillmentAddress: true,
        nextEndsAt: true,
        extensionChargeMinor: true,
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: DASHBOARD_RENTAL_OPERATION_LIMIT,
    },
  } satisfies Prisma.RentalSelect;
}

const maintenanceSelect = {
  id: true,
  vehicleId: true,
  title: true,
  status: true,
  scheduledAt: true,
  scheduledEndsAt: true,
  vehicle: { select: { make: true, model: true, registrationNumber: true } },
} satisfies Prisma.MaintenanceRecordSelect;

const washSelect = {
  id: true,
  vehicleId: true,
  status: true,
  scheduledAt: true,
  startedAt: true,
  completedAt: true,
  vehicle: { select: { make: true, model: true, registrationNumber: true } },
} satisfies Prisma.WashRecordSelect;

function vehicleLabel(vehicle: {
  make: string | null;
  model: string;
  registrationNumber: string | null;
}) {
  return [vehicle.make, vehicle.model, vehicle.registrationNumber].filter(Boolean).join(' · ');
}

export function createDashboardQueries(
  repository: DashboardRepository,
  getSession: () => Promise<DashboardSession | null>,
  dependencies: DashboardQueryDependencies,
) {
  return {
    async getOverview(
      period: DashboardPeriod,
      now: Date = new Date(),
    ): Promise<DashboardOverviewDto> {
      const session = await getSession();
      if (!session) throw new Error('Доступ к панели управления запрещён.');

      const window = getDashboardWindow(period, now);
      const companyId = session.companyId;
      const activeRentalWhere = {
        companyId,
        status: { in: ['CONFIRMED', 'ACTIVE'] },
        startsAt: { lt: window.toExclusive },
        endsAt: { gt: window.from },
      };
      const activeMaintenanceWhere = {
        status: { in: ['PLANNED', 'IN_PROGRESS'] },
        scheduledAt: { lt: window.toExclusive },
        OR: [{ scheduledEndsAt: { gt: window.from } }, { scheduledEndsAt: null }],
      };
      const activeWashWhere = {
        status: { in: ['PLANNED', 'IN_PROGRESS'] },
        scheduledAt: { lt: window.toExclusive },
        OR: [{ completedAt: { gt: window.from } }, { completedAt: null }],
      };

      const [vehicles, rentals, maintenanceRecords, washRecords] = await Promise.all([
        repository.vehicleFindMany({
          where: { companyId, archivedAt: null, isDemoImport: false },
          select: {
            ...vehicleSelect,
            rentals: { where: activeRentalWhere, select: { id: true } },
            maintenanceRecords: { where: activeMaintenanceWhere, select: { id: true } },
            washRecords: { where: activeWashWhere, select: { id: true } },
          },
          orderBy: { id: 'asc' },
        }),
        repository.rentalFindMany({
          where: {
            companyId,
            status: { in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] },
            OR: [
              { startsAt: { lt: window.toExclusive }, endsAt: { gt: window.from } },
              { completedAt: { gte: window.from, lt: window.toExclusive } },
            ],
          },
          select: rentalSelect(session.canViewClientPhone),
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        }),
        repository.maintenanceFindMany({
          where: {
            companyId,
            vehicle: { companyId },
            status: { in: ['PLANNED', 'IN_PROGRESS'] },
            scheduledAt: { gte: window.from, lt: window.toExclusive },
          },
          select: maintenanceSelect,
          orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        }),
        repository.washFindMany({
          where: {
            companyId,
            vehicle: { companyId },
            status: { in: ['PLANNED', 'IN_PROGRESS'] },
            scheduledAt: { gte: window.from, lt: window.toExclusive },
          },
          select: washSelect,
          orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        }),
      ]);

      return buildDashboardOverview({
        period: { key: period, ...window },
        now,
        vehicles: (vehicles as RawVehicle[]).map((vehicle) => ({
          id: vehicle.id,
          label: vehicleLabel(vehicle),
          position: vehicle.positions[0] ?? null,
          archivedAt: vehicle.archivedAt,
          isDemoImport: vehicle.isDemoImport,
        })),
        rentals: (rentals as RawRental[]).map((rental) => ({
          ...rental,
          client: {
            firstName: rental.client.firstName,
            middleName: rental.client.middleName,
            lastName: rental.client.lastName,
            phone:
              session.canViewClientPhone && rental.client.phoneEncrypted
                ? decryptField(rental.client.phoneEncrypted, dependencies.encryptionKey)
                : null,
          },
          vehicleLabel: vehicleLabel(rental.vehicle),
        })),
        maintenanceRecords: (maintenanceRecords as RawMaintenance[]).map((record) => ({
          ...record,
          vehicleLabel: vehicleLabel(record.vehicle),
        })),
        washRecords: (washRecords as RawWash[]).map((record) => ({
          ...record,
          vehicleLabel: vehicleLabel(record.vehicle),
        })),
      });
    },
  };
}

async function getCurrentDashboardSession(): Promise<DashboardSession | null> {
  const session = await getAuthenticatedSession();
  if (!session) return null;

  const membership = await prisma.companyMember.findFirst({
    where: { userId: session.user.id },
    select: { companyId: true, role: true, additionalPermissions: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (!membership) return null;

  return {
    companyId: membership.companyId,
    canViewClientPhone: hasCompanyPermission(
      membership.role,
      membership.additionalPermissions,
      'VIEW_CLIENTS',
    ),
  };
}

const queries = createDashboardQueries(
  {
    vehicleFindMany: (args) => prisma.vehicle.findMany(args as Prisma.VehicleFindManyArgs),
    rentalFindMany: (args) => prisma.rental.findMany(args as Prisma.RentalFindManyArgs),
    maintenanceFindMany: (args) => {
      const query = args as Prisma.MaintenanceRecordFindManyArgs & {
        where: Prisma.MaintenanceRecordWhereInput & { companyId?: string };
      };
      const { companyId: _companyId, ...where } = query.where;
      return prisma.maintenanceRecord.findMany({ ...query, where });
    },
    washFindMany: (args) => {
      const query = args as Prisma.WashRecordFindManyArgs & {
        where: Prisma.WashRecordWhereInput & { companyId?: string };
      };
      const { companyId: _companyId, ...where } = query.where;
      return prisma.washRecord.findMany({ ...query, where });
    },
  },
  getCurrentDashboardSession,
  { encryptionKey: process.env.CLIENT_DATA_ENCRYPTION_KEY ?? '' },
);

export const getDashboardOverviewForCurrentUser = queries.getOverview;
