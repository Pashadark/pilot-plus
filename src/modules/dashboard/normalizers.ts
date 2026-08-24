import { OFFLINE_AFTER_MS } from '@/modules/vehicles/gps-status';

import type { DashboardPeriod } from './date-window';
import type {
  DashboardAttentionItemDto,
  DashboardOverviewDto,
  DashboardWorkItemDto,
} from './overview-types';

const DAY_MS = 86_400_000;
const MOSCOW_TIME_ZONE = 'Europe/Moscow';

type DashboardDateWindow = {
  from: Date;
  toExclusive: Date;
  label: string;
};

type RentalOperationSource = {
  id: string;
  type: 'HANDOVER' | 'EXTENSION' | 'RETURN';
  status: 'DRAFT' | 'COMMITTED' | 'ERROR';
  occurredAt: Date;
  depositStatus:
    'NOT_COLLECTED' | 'COLLECTED' | 'RETURNED' | 'PARTIALLY_WITHHELD' | 'WITHHELD' | null;
  fulfillmentMethod: 'OFFICE' | 'DELIVERY' | null;
  fulfillmentAddress: string | null;
  nextEndsAt?: Date | null;
  extensionChargeMinor?: bigint | null;
};

type RentalSource = {
  id: string;
  vehicleId: string;
  status: 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startsAt: Date;
  endsAt: Date;
  totalPriceMinor: bigint;
  depositMinor: bigint | null;
  contractNumber: string | null;
  client: { lastName: string; firstName: string; middleName: string | null; phone: string | null };
  vehicleLabel: string;
  operations: readonly RentalOperationSource[];
};

type VehicleSource = {
  id: string;
  label: string;
  position: { recordedAt: Date } | null;
  archivedAt?: Date | null;
  isDemoImport?: boolean;
};

type MaintenanceSource = {
  id: string;
  vehicleId: string;
  title: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
  scheduledAt: Date | null;
  scheduledEndsAt: Date | null;
  vehicleLabel: string;
};

type WashSource = {
  id: string;
  vehicleId: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  scheduledAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  vehicleLabel: string;
};

export type DashboardOverviewSource = {
  period: DashboardDateWindow & { key: DashboardPeriod };
  now: Date;
  /** The server query supplies only non-archived, non-demo vehicles from the authenticated company. */
  vehicles: readonly VehicleSource[];
  rentals: readonly RentalSource[];
  maintenanceRecords: readonly MaintenanceSource[];
  washRecords: readonly WashSource[];
};

function overlaps(startsAt: Date, endsAt: Date | null | undefined, window: DashboardDateWindow) {
  return startsAt < window.toExclusive && (endsAt ?? window.toExclusive) > window.from;
}

function occursIn(date: Date, window: DashboardDateWindow) {
  return date >= window.from && date < window.toExclusive;
}

function isCompanyRealVehicle(vehicle: VehicleSource) {
  return vehicle.archivedAt === null || vehicle.archivedAt === undefined
    ? vehicle.isDemoImport !== true
    : false;
}

function clientLabel(client: RentalSource['client']) {
  return [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ');
}

function latestCommittedDepositOperation(operations: readonly RentalOperationSource[]) {
  return operations
    .filter((operation) => operation.status === 'COMMITTED' && operation.depositStatus !== null)
    .sort(
      (left, right) =>
        right.occurredAt.getTime() - left.occurredAt.getTime() || right.id.localeCompare(left.id),
    )[0];
}

function rentalBillableDays(rental: RentalSource) {
  return Math.max(1, Math.ceil((rental.endsAt.getTime() - rental.startsAt.getTime()) / DAY_MS));
}

function moscowDayStart(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MOSCOW_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(value);
  const byType = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  );
  return new Date(Date.UTC(byType.year, byType.month - 1, byType.day, -3));
}

function allocatedRentalEarnedMinor(rental: RentalSource, period: DashboardDateWindow) {
  if (rental.status === 'DRAFT' || rental.status === 'CANCELLED') return 0n;

  const days = rentalBillableDays(rental);
  const baseShare = rental.totalPriceMinor / BigInt(days);
  const remainder = rental.totalPriceMinor % BigInt(days);
  const firstDay = moscowDayStart(rental.startsAt);
  let earned = 0n;

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const dayStart = new Date(firstDay.getTime() + dayIndex * DAY_MS);
    if (!occursIn(dayStart, period)) continue;
    earned += baseShare + (BigInt(dayIndex) < remainder ? 1n : 0n);
  }

  return earned;
}

function rentalWorkItems(
  rental: RentalSource,
  source: DashboardOverviewSource,
): DashboardWorkItemDto[] {
  if (rental.status === 'DRAFT' || rental.status === 'CANCELLED') return [];

  const client = clientLabel(rental.client);
  const shared = {
    vehicleLabel: rental.vehicleLabel,
    clientLabel: client || null,
    phone: rental.client.phone,
    contractNumber: rental.contractNumber,
    href: `/rentals/${rental.id}`,
  };
  const items: DashboardWorkItemDto[] = [];

  if (rental.status === 'CONFIRMED' && occursIn(rental.startsAt, source.period)) {
    const handover = rental.operations
      .filter((operation) => operation.status === 'COMMITTED' && operation.type === 'HANDOVER')
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())[0];
    const isDelivery = handover?.fulfillmentMethod === 'DELIVERY';
    items.push({
      id: `${isDelivery ? 'rental-delivery' : 'rental-handover'}:${rental.id}`,
      kind: isDelivery ? 'DELIVERY' : 'HANDOVER',
      scheduledAt: rental.startsAt.toISOString(),
      title: isDelivery ? 'Доставить автомобиль' : 'Выдать автомобиль',
      tone: 'info',
      address: handover?.fulfillmentAddress ?? null,
      amountMinor: null,
      overdue: false,
      ...shared,
    });
  }

  if (
    (rental.status === 'CONFIRMED' || rental.status === 'ACTIVE') &&
    occursIn(rental.endsAt, source.period)
  ) {
    const overdue = rental.endsAt < source.now;
    items.push({
      id: `rental-return:${rental.id}`,
      kind: 'RETURN',
      scheduledAt: rental.endsAt.toISOString(),
      title: 'Принять возврат автомобиля',
      tone: overdue ? 'danger' : 'warning',
      address: null,
      amountMinor: null,
      overdue,
      ...shared,
    });
  }

  const deposit = latestCommittedDepositOperation(rental.operations);
  if (
    rental.status === 'COMPLETED' &&
    deposit?.depositStatus === 'COLLECTED' &&
    occursIn(deposit.occurredAt, source.period)
  ) {
    items.push({
      id: `deposit-return:${rental.id}`,
      kind: 'DEPOSIT_RETURN',
      scheduledAt: deposit.occurredAt.toISOString(),
      title: 'Вернуть депозит',
      tone: 'warning',
      address: null,
      amountMinor: rental.depositMinor?.toString() ?? null,
      overdue: deposit.occurredAt < source.now,
      ...shared,
    });
  }

  return items;
}

function serviceWorkItems(source: DashboardOverviewSource): DashboardWorkItemDto[] {
  const maintenanceItems = source.maintenanceRecords.flatMap((record) => {
    if (
      !record.scheduledAt ||
      !['PLANNED', 'IN_PROGRESS'].includes(record.status) ||
      !occursIn(record.scheduledAt, source.period)
    )
      return [];
    const overdue = record.scheduledAt < source.now;
    return [
      {
        id: `maintenance:${record.id}`,
        kind: 'MAINTENANCE' as const,
        scheduledAt: record.scheduledAt.toISOString(),
        title: record.title,
        tone: overdue ? ('danger' as const) : ('warning' as const),
        href: '/maintenance',
        vehicleLabel: record.vehicleLabel,
        clientLabel: null,
        phone: null,
        contractNumber: null,
        address: null,
        amountMinor: null,
        overdue,
      },
    ];
  });
  const washItems = source.washRecords.flatMap((record) => {
    if (
      !['PLANNED', 'IN_PROGRESS'].includes(record.status) ||
      !occursIn(record.scheduledAt, source.period)
    )
      return [];
    const overdue = record.scheduledAt < source.now;
    return [
      {
        id: `wash:${record.id}`,
        kind: 'WASH' as const,
        scheduledAt: record.scheduledAt.toISOString(),
        title: 'Мойка автомобиля',
        tone: overdue ? ('danger' as const) : ('warning' as const),
        href: '/wash',
        vehicleLabel: record.vehicleLabel,
        clientLabel: null,
        phone: null,
        contractNumber: null,
        address: null,
        amountMinor: null,
        overdue,
      },
    ];
  });
  return [...maintenanceItems, ...washItems];
}

function attentionItems(
  workItems: readonly DashboardWorkItemDto[],
  vehicles: readonly VehicleSource[],
  now: Date,
): DashboardAttentionItemDto[] {
  const overdueItems = workItems
    .filter((item) => item.overdue)
    .map((item) => ({
      id: `overdue:${item.id}`,
      tone: 'danger' as const,
      title: item.title,
      description: `${item.vehicleLabel}: просрочено`,
      href: item.href,
    }));
  const offlineVehicles = vehicles
    .filter(
      (vehicle) =>
        !vehicle.position ||
        now.getTime() - vehicle.position.recordedAt.getTime() > OFFLINE_AFTER_MS,
    )
    .map((vehicle) => ({
      id: `offline:${vehicle.id}`,
      tone: 'warning' as const,
      title: 'Нет актуального GPS-сигнала',
      description: vehicle.label,
      href: `/vehicles/${vehicle.id}`,
    }));
  return [...overdueItems, ...offlineVehicles].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

export function buildDashboardOverview(source: DashboardOverviewSource): DashboardOverviewDto {
  const companyVehicles = source.vehicles.filter(isCompanyRealVehicle);
  const serviceVehicleIds = new Set([
    ...source.maintenanceRecords
      .filter(
        (record) =>
          ['PLANNED', 'IN_PROGRESS'].includes(record.status) &&
          record.scheduledAt &&
          overlaps(record.scheduledAt, record.scheduledEndsAt, source.period),
      )
      .map((record) => record.vehicleId),
    ...source.washRecords
      .filter(
        (record) =>
          ['PLANNED', 'IN_PROGRESS'].includes(record.status) &&
          overlaps(record.scheduledAt, record.completedAt ?? null, source.period),
      )
      .map((record) => record.vehicleId),
  ]);
  const occupiedVehicleIds = new Set(
    source.rentals
      .filter(
        (rental) =>
          ['CONFIRMED', 'ACTIVE'].includes(rental.status) &&
          overlaps(rental.startsAt, rental.endsAt, source.period),
      )
      .map((rental) => rental.vehicleId),
  );
  const workItems = [
    ...source.rentals.flatMap((rental) => rentalWorkItems(rental, source)),
    ...serviceWorkItems(source),
  ].sort(
    (left, right) =>
      Number(right.overdue) - Number(left.overdue) ||
      left.scheduledAt.localeCompare(right.scheduledAt) ||
      left.id.localeCompare(right.id),
  );
  const offlineVehicles = companyVehicles.filter(
    (vehicle) =>
      !vehicle.position ||
      source.now.getTime() - vehicle.position.recordedAt.getTime() > OFFLINE_AFTER_MS,
  ).length;
  const earnedMinor = source.rentals.reduce(
    (total, rental) => total + allocatedRentalEarnedMinor(rental, source.period),
    0n,
  );
  const heldDepositsMinor = source.rentals.reduce((total, rental) => {
    const latestDeposit = latestCommittedDepositOperation(rental.operations);
    return latestDeposit?.depositStatus === 'COLLECTED'
      ? total + (rental.depositMinor ?? 0n)
      : total;
  }, 0n);
  const serviceVehicles = companyVehicles.filter((vehicle) =>
    serviceVehicleIds.has(vehicle.id),
  ).length;
  const occupiedVehicles = companyVehicles.filter(
    (vehicle) => !serviceVehicleIds.has(vehicle.id) && occupiedVehicleIds.has(vehicle.id),
  ).length;

  return {
    period: {
      key: source.period.key,
      label: source.period.label,
      from: source.period.from.toISOString(),
      toExclusive: source.period.toExclusive.toISOString(),
    },
    kpis: {
      earnedMinor: earnedMinor.toString(),
      earnedIsEstimated: true,
      heldDepositsMinor: heldDepositsMinor.toString(),
      freeVehicles: companyVehicles.length - serviceVehicles - occupiedVehicles,
      occupiedVehicles,
      serviceVehicles,
      offlineVehicles,
    },
    workItems,
    attentionItems: attentionItems(workItems, companyVehicles, source.now),
  };
}
