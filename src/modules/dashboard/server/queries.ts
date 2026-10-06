import 'server-only';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { hasCompanyPermission } from '@/modules/admin/access/permissions';
import { decryptField } from '@/services/security/field-encryption';
import { getAuthenticatedSession } from '@/services/auth/session';

import { getDashboardWindow, type DashboardPeriod, type DashboardWindow } from '../date-window';
import { buildDashboardOverview } from '../normalizers';
import type { DashboardOverviewDto } from '../overview-types';

type DashboardSession = {
  companyId: string;
  canViewClientPhone: boolean;
};

type DashboardRepository = {
  vehicleFindMany(args: unknown): Promise<unknown[]>;
  rentalFindMany(args: unknown): Promise<unknown[]>;
  clientCount(args: unknown): Promise<number>;
  maintenanceFindMany(args: unknown): Promise<unknown[]>;
  washFindMany(args: unknown): Promise<unknown[]>;
  taskFindMany(args: unknown): Promise<unknown[]>;
  leadFindMany(args: unknown): Promise<unknown[]>;
  fineFindMany(args: unknown): Promise<unknown[]>;
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
  positions: Array<{ id: string; recordedAt: Date; fuelLevelPercent: unknown | null }>;
  rentalOperations: Array<{
    id: string;
    occurredAt: Date;
    fuelLevelPercent: number | null;
  }>;
};

type RawRental = {
  id: string;
  clientId?: string;
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
  payments: Array<{
    kind: 'RENT' | 'DEPOSIT';
    status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
    amountMinor: bigint;
  }>;
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
    notes?: string | null;
  }>;
};

type RawMaintenance = {
  id: string;
  vehicleId: string;
  title: string;
  recordType: 'MAINTENANCE' | 'REPAIR';
  status:
    | 'PLANNED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'OVERDUE'
    | 'CANCELLED'
    | 'DAMAGE_REPORTED'
    | 'WAITING_REPAIR';
  damageReportedAt: Date | null;
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

type RawTask = {
  id: string;
  title: string;
  description: string | null;
  dueAt: Date;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  href: string | null;
  assignedTo: { name: string } | null;
};

type RawLead = {
  id: string;
  name: string;
  lastName: string | null;
  source: string | null;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED';
  nextContactAt: Date | null;
  createdAt: Date;
  phoneEncrypted?: string;
  assignedTo: { name: string } | null;
};

type RawFine = {
  status?: string;
  discountExpiresAt?: Date | null;
  id: string;
  decreeNumber: string;
  createdAt: Date;
  offenseAt: Date;
  currentAmountMinor: bigint;
  description: string | null;
  address: string | null;
  vehicle: {
    make: string | null;
    modelName: string | null;
    model: string;
    registrationNumber: string | null;
  } | null;
  client: { firstName: string; middleName: string | null; lastName: string } | null;
  rental: { contractNumber: string | null } | null;
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
    select: { id: true, recordedAt: true, fuelLevelPercent: true },
    orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
    take: 1,
  },
  rentalOperations: {
    where: { status: 'COMMITTED', fuelLevelPercent: { not: null } },
    select: { id: true, occurredAt: true, fuelLevelPercent: true },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: 1,
  },
} satisfies Prisma.VehicleSelect;

function optionalNumber(value: unknown | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rentalSelect(canViewClientPhone: boolean) {
  return {
    id: true,
    ...(canViewClientPhone ? { clientId: true } : {}),
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
    payments: {
      where: { kind: 'DEPOSIT', status: 'CONFIRMED' },
      select: { kind: true, status: true, amountMinor: true },
    },
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
        notes: true,
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    },
  } satisfies Prisma.RentalSelect;
}

const maintenanceSelect = {
  id: true,
  vehicleId: true,
  title: true,
  recordType: true,
  status: true,
  damageReportedAt: true,
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
  modelName?: string | null;
  model: string;
  registrationNumber: string | null;
}) {
  const model = vehicle.modelName ?? vehicle.model;
  const name =
    vehicle.make && !model.toLocaleLowerCase().startsWith(vehicle.make.toLocaleLowerCase())
      ? `${vehicle.make} ${model}`
      : model;
  return [name, vehicle.registrationNumber].filter(Boolean).join(' · ');
}

export function createDashboardQueries(
  repository: DashboardRepository,
  getSession: () => Promise<DashboardSession | null>,
  dependencies: DashboardQueryDependencies,
) {
  return {
    async getOverview(
      period: DashboardPeriod | DashboardWindow,
      now: Date = new Date(),
    ): Promise<DashboardOverviewDto> {
      const session = await getSession();
      if (!session) throw new Error('Доступ к панели управления запрещён.');

      const window = typeof period === 'string' ? getDashboardWindow(period, now) : period;
      const periodKey = typeof period === 'string' ? period : period.key;
      const queueWindow =
        periodKey === 'today'
          ? { ...window, toExclusive: new Date(window.from.getTime() + 30 * 86_400_000) }
          : window;
      const companyId = session.companyId;
      const activeRentalWhere = {
        companyId,
        status: { in: ['CONFIRMED', 'ACTIVE'] },
        startsAt: { lt: window.toExclusive },
        endsAt: { gt: window.from },
      };
      const activeMaintenanceWhere = {
        status: { in: ['PLANNED', 'IN_PROGRESS', 'DAMAGE_REPORTED', 'WAITING_REPAIR'] },
        OR: [
          {
            scheduledAt: { lt: window.toExclusive },
            OR: [{ scheduledEndsAt: { gt: window.from } }, { scheduledEndsAt: null }],
          },
          { recordType: 'REPAIR', damageReportedAt: { lt: window.toExclusive } },
        ],
      };
      const activeWashWhere = {
        status: { in: ['PLANNED', 'IN_PROGRESS'] },
        scheduledAt: { lt: window.toExclusive },
        OR: [{ completedAt: { gt: window.from } }, { completedAt: null }],
      };

      const [
        vehicles,
        rentals,
        financeRentals,
        clientCount,
        maintenanceRecords,
        washRecords,
        manualTasks,
        leads,
        fines,
      ] = await Promise.all([
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
            OR: [
              {
                status: { in: ['CONFIRMED', 'ACTIVE'] },
                startsAt: { lt: queueWindow.toExclusive },
              },
              {
                status: 'COMPLETED',
                depositMinor: { gt: 0 },
              },
            ],
          },
          select: rentalSelect(session.canViewClientPhone),
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        }),
        repository.rentalFindMany({
          where: {
            companyId,
            status: { in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] },
          },
          select: rentalSelect(session.canViewClientPhone),
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        }),
        repository.clientCount({ where: { companyId, archivedAt: null } }),
        repository.maintenanceFindMany({
          where: {
            companyId,
            vehicle: { companyId },
            status: {
              in: ['PLANNED', 'IN_PROGRESS', 'OVERDUE', 'DAMAGE_REPORTED', 'WAITING_REPAIR'],
            },
            OR: [
              {
                scheduledAt: { lt: queueWindow.toExclusive },
              },
              { recordType: 'REPAIR', damageReportedAt: { lt: queueWindow.toExclusive } },
            ],
          },
          select: maintenanceSelect,
          orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        }),
        repository.washFindMany({
          where: {
            companyId,
            vehicle: { companyId },
            status: { in: ['PLANNED', 'IN_PROGRESS'] },
            scheduledAt: { lt: queueWindow.toExclusive },
          },
          select: washSelect,
          orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        }),
        repository.taskFindMany({
          where: {
            companyId,
            status: 'OPEN',
            dueAt:
              queueWindow.toExclusive > now
                ? { lt: queueWindow.toExclusive }
                : { gte: queueWindow.from, lt: queueWindow.toExclusive },
          },
          select: {
            id: true,
            title: true,
            description: true,
            dueAt: true,
            priority: true,
            href: true,
            assignedTo: { select: { name: true } },
          },
          orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
        }),
        repository.leadFindMany({
          where: {
            companyId,
            status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] },
            OR:
              queueWindow.toExclusive > now
                ? [{ nextContactAt: null }, { nextContactAt: { lt: queueWindow.toExclusive } }]
                : [{ nextContactAt: { gte: queueWindow.from, lt: queueWindow.toExclusive } }],
          },
          select: {
            id: true,
            name: true,
            lastName: true,
            source: true,
            status: true,
            nextContactAt: true,
            createdAt: true,
            ...(session.canViewClientPhone ? { phoneEncrypted: true } : {}),
            assignedTo: { select: { name: true } },
          },
          orderBy: [{ nextContactAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        }),
        repository.fineFindMany({
          where: {
            companyId,
            status: { in: ['NEW', 'UNPAID', 'OVERDUE'] },
          },
          select: {
            id: true,
            status: true,
            discountExpiresAt: true,
            decreeNumber: true,
            createdAt: true,
            offenseAt: true,
            currentAmountMinor: true,
            description: true,
            address: true,
            vehicle: {
              select: {
                make: true,
                modelName: true,
                model: true,
                registrationNumber: true,
              },
            },
            client: {
              select: { firstName: true, middleName: true, lastName: true },
            },
            rental: { select: { contractNumber: true } },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
      ]);

      return buildDashboardOverview({
        period: { key: periodKey, ...window },
        workPeriod: { key: periodKey, ...queueWindow },
        now,
        clientCount,
        vehicles: (vehicles as RawVehicle[]).map((vehicle) => ({
          id: vehicle.id,
          label: vehicleLabel(vehicle),
          position: vehicle.positions[0] ?? null,
          fuelLevelPercent:
            optionalNumber(vehicle.positions[0]?.fuelLevelPercent) ??
            optionalNumber(vehicle.rentalOperations[0]?.fuelLevelPercent),
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
        financeRentals: (financeRentals as RawRental[]).map((rental) => ({
          ...rental,
          client: {
            firstName: rental.client.firstName,
            middleName: rental.client.middleName,
            lastName: rental.client.lastName,
            phone: null,
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
        manualTasks: (manualTasks as RawTask[]).map((task) => ({
          ...task,
          assignedToName: task.assignedTo?.name ?? null,
        })),
        leads: (leads as RawLead[]).map((lead) => ({
          ...lead,
          phone:
            session.canViewClientPhone && lead.phoneEncrypted
              ? decryptField(lead.phoneEncrypted, dependencies.encryptionKey)
              : null,
          assignedToName: lead.assignedTo?.name ?? null,
        })),
        fines: (fines as RawFine[]).map((fine) => ({
          ...fine,
          vehicleLabel: fine.vehicle ? vehicleLabel(fine.vehicle) : null,
          clientLabel: fine.client
            ? [fine.client.lastName, fine.client.firstName, fine.client.middleName]
                .filter(Boolean)
                .join(' ')
            : null,
          contractNumber: fine.rental?.contractNumber ?? null,
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
    clientCount: (args) => prisma.client.count(args as Prisma.ClientCountArgs),
    maintenanceFindMany: (args) => {
      const query = args as Prisma.MaintenanceRecordFindManyArgs & {
        where: Prisma.MaintenanceRecordWhereInput & { companyId?: string };
      };
      const { companyId, ...where } = query.where;
      void companyId;
      return prisma.maintenanceRecord.findMany({ ...query, where });
    },
    washFindMany: (args) => {
      const query = args as Prisma.WashRecordFindManyArgs & {
        where: Prisma.WashRecordWhereInput & { companyId?: string };
      };
      const { companyId, ...where } = query.where;
      void companyId;
      return prisma.washRecord.findMany({ ...query, where });
    },
    taskFindMany: (args) =>
      prisma.operationsTask.findMany(args as Prisma.OperationsTaskFindManyArgs),
    leadFindMany: (args) => prisma.lead.findMany(args as Prisma.LeadFindManyArgs),
    fineFindMany: (args) => prisma.fine.findMany(args as Prisma.FineFindManyArgs),
  },
  getCurrentDashboardSession,
  { encryptionKey: process.env.CLIENT_DATA_ENCRYPTION_KEY ?? '' },
);

export const getDashboardOverviewForCurrentUser = queries.getOverview;
