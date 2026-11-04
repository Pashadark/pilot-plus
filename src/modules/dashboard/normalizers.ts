import { OFFLINE_AFTER_MS } from '@/modules/vehicles/gps-status';
import { isLowFuelLevel } from '@/modules/vehicles/fuel-level';
import { resolveRentalDepositState } from '@/modules/rentals/deposit-state';
import { addPilotBusinessDays, comparePilotBusinessDate } from '@/shared/business-time';

import type { DashboardPeriod } from './date-window';
import type {
  DashboardAttentionItemDto,
  DashboardOverviewDto,
  DashboardWorkItemDto,
} from './overview-types';

const DAY_MS = 86_400_000;
const MOSCOW_TIME_ZONE = 'Europe/Moscow';
const DEPOSIT_RETURN_BUSINESS_DAYS = 21;
const DEPOSIT_REMINDER_DAYS = 3;

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
  notes?: string | null;
};

type RentalSource = {
  id: string;
  clientId?: string;
  vehicleId: string;
  status: 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startsAt: Date;
  endsAt: Date;
  completedAt?: Date | null;
  totalPriceMinor: bigint;
  depositMinor: bigint | null;
  contractNumber: string | null;
  client: { lastName: string; firstName: string; middleName: string | null; phone: string | null };
  vehicleLabel: string;
  payments?: readonly { kind: string; status: string; amountMinor: bigint }[];
  operations: readonly RentalOperationSource[];
};

type VehicleSource = {
  id: string;
  label: string;
  position: { recordedAt: Date } | null;
  fuelLevelPercent: number | null;
  archivedAt?: Date | null;
  isDemoImport?: boolean;
};

type MaintenanceSource = {
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

type ManualTaskSource = {
  id: string;
  title: string;
  description: string | null;
  dueAt: Date;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  href: string | null;
  assignedToName: string | null;
};

type LeadSource = {
  id: string;
  name: string;
  lastName: string | null;
  source: string | null;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED';
  nextContactAt: Date | null;
  createdAt: Date;
  phone: string | null;
  assignedToName: string | null;
};

type FineSource = {
  status?: string;
  discountExpiresAt?: Date | null;
  id: string;
  decreeNumber: string;
  createdAt: Date;
  offenseAt: Date;
  currentAmountMinor: bigint;
  description: string | null;
  address: string | null;
  vehicleLabel: string | null;
  clientLabel: string | null;
  contractNumber: string | null;
};

export type DashboardOverviewSource = {
  period: DashboardDateWindow & { key: DashboardPeriod | 'custom' };
  workPeriod?: DashboardDateWindow & { key: DashboardPeriod | 'custom' };
  now: Date;
  /** The server query supplies only non-archived, non-demo vehicles from the authenticated company. */
  vehicles: readonly VehicleSource[];
  rentals: readonly RentalSource[];
  financeRentals?: readonly RentalSource[];
  clientCount: number;
  maintenanceRecords: readonly MaintenanceSource[];
  washRecords: readonly WashSource[];
  manualTasks?: readonly ManualTaskSource[];
  leads?: readonly LeadSource[];
  fines?: readonly FineSource[];
};

function overlaps(startsAt: Date, endsAt: Date | null | undefined, window: DashboardDateWindow) {
  return startsAt < window.toExclusive && (endsAt ?? window.toExclusive) > window.from;
}

function occursIn(date: Date, window: DashboardDateWindow) {
  return date >= window.from && date < window.toExclusive;
}

function isVisibleOverdue(date: Date, source: DashboardOverviewSource) {
  return date < source.now && source.period.toExclusive > source.now;
}

function isCompanyRealVehicle(vehicle: VehicleSource) {
  return vehicle.archivedAt === null || vehicle.archivedAt === undefined
    ? vehicle.isDemoImport !== true
    : false;
}

function clientLabel(client: RentalSource['client']) {
  return [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ');
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
  if (rental.status === 'DRAFT' || rental.status === 'CANCELLED') return BigInt(0);

  const billableDays: Date[] = [];
  for (
    let dayStart = moscowDayStart(rental.startsAt);
    dayStart < rental.endsAt;
    dayStart = new Date(dayStart.getTime() + DAY_MS)
  ) {
    if (new Date(dayStart.getTime() + DAY_MS) > rental.startsAt) billableDays.push(dayStart);
  }

  const baseShare = rental.totalPriceMinor / BigInt(billableDays.length);
  const remainder = rental.totalPriceMinor % BigInt(billableDays.length);
  let earned = BigInt(0);

  for (const [dayIndex, dayStart] of billableDays.entries()) {
    if (!occursIn(dayStart, period)) continue;
    earned += baseShare + (BigInt(dayIndex) < remainder ? BigInt(1) : BigInt(0));
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
    details: {
      vehicleHref: `/vehicles/${rental.vehicleId}`,
      clientHref: rental.clientId ? `/clients/${rental.clientId}` : undefined,
      startsAt: rental.startsAt.toISOString(),
      endsAt: rental.endsAt.toISOString(),
      collectedMinor: rental.payments?.some((p) => p.kind === 'DEPOSIT' && p.status === 'CONFIRMED')
        ? rental.payments
            .filter((p) => p.kind === 'DEPOSIT' && p.status === 'CONFIRMED')
            .reduce((sum, p) => sum + p.amountMinor, BigInt(0))
            .toString()
        : null,
      history: [...rental.operations]
        .filter((op) => op.status === 'COMMITTED')
        .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
        .slice(0, 5)
        .map((op) => ({
          id: op.id,
          at: op.occurredAt.toISOString(),
          label:
            op.type === 'HANDOVER'
              ? 'Автомобиль выдан'
              : op.type === 'EXTENSION'
                ? 'Аренда продлена'
                : op.type === 'RETURN'
                  ? 'Автомобиль возвращён'
                  : 'Операция по договору',
          notes: op.notes ?? null,
        })),
    },
  };
  const items: DashboardWorkItemDto[] = [];

  if (
    rental.status === 'CONFIRMED' &&
    (occursIn(rental.startsAt, source.period) || isVisibleOverdue(rental.startsAt, source))
  ) {
    const handover = rental.operations
      .filter((operation) => operation.status === 'COMMITTED' && operation.type === 'HANDOVER')
      .sort(
        (left, right) =>
          right.occurredAt.getTime() - left.occurredAt.getTime() || right.id.localeCompare(left.id),
      )[0];
    const isDelivery = handover?.fulfillmentMethod === 'DELIVERY';
    items.push({
      id: `${isDelivery ? 'rental-delivery' : 'rental-handover'}:${rental.id}`,
      kind: isDelivery ? 'DELIVERY' : 'HANDOVER',
      scheduledAt: rental.startsAt.toISOString(),
      title: isDelivery ? 'Доставить автомобиль' : 'Выдать автомобиль',
      tone: 'info',
      address: handover?.fulfillmentAddress ?? null,
      amountMinor: null,
      overdue: rental.startsAt < source.now,
      ...shared,
    });
  }

  if (
    (rental.status === 'CONFIRMED' || rental.status === 'ACTIVE') &&
    (occursIn(rental.endsAt, source.period) || isVisibleOverdue(rental.endsAt, source))
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

  const depositStatus = resolveRentalDepositState({
    expectedMinor: rental.depositMinor,
    operations: rental.operations,
    payments: rental.payments ?? [],
  });
  const committedReturn = rental.operations
    .filter((operation) => operation.status === 'COMMITTED' && operation.type === 'RETURN')
    .sort(
      (left, right) =>
        right.occurredAt.getTime() - left.occurredAt.getTime() || right.id.localeCompare(left.id),
    )[0];
  const completedAt = committedReturn?.occurredAt ?? rental.completedAt ?? rental.endsAt;
  const depositReturnDueAt = addPilotBusinessDays(completedAt, DEPOSIT_RETURN_BUSINESS_DAYS);
  const depositReminderStartsAt = new Date(
    depositReturnDueAt.getTime() - DEPOSIT_REMINDER_DAYS * DAY_MS,
  );
  const depositReminderVisible =
    (depositReturnDueAt >= source.period.from &&
      depositReminderStartsAt < source.period.toExclusive) ||
    isVisibleOverdue(depositReturnDueAt, source);
  const depositDateOrder = comparePilotBusinessDate(depositReturnDueAt, source.now);
  const depositOverdue = depositDateOrder < 0;
  if (rental.status === 'COMPLETED' && depositStatus === 'COLLECTED' && depositReminderVisible) {
    items.push({
      id: `deposit-return:${rental.id}`,
      kind: 'DEPOSIT_RETURN',
      scheduledAt: depositReturnDueAt.toISOString(),
      title: depositDateOrder === 0 ? 'Вернуть депозит сегодня' : 'Вернуть депозит',
      tone: depositOverdue ? 'danger' : 'warning',
      address: null,
      amountMinor: rental.depositMinor?.toString() ?? null,
      overdue: depositOverdue,
      ...shared,
    });
  }

  return items;
}

function serviceWorkItems(source: DashboardOverviewSource): DashboardWorkItemDto[] {
  const maintenanceItems = source.maintenanceRecords.flatMap((record) => {
    if (
      !record.scheduledAt ||
      !['PLANNED', 'IN_PROGRESS', 'OVERDUE'].includes(record.status) ||
      (!occursIn(record.scheduledAt, source.period) &&
        !isVisibleOverdue(record.scheduledAt, source))
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
      (!occursIn(record.scheduledAt, source.period) &&
        !isVisibleOverdue(record.scheduledAt, source))
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

function manualTaskWorkItems(source: DashboardOverviewSource): DashboardWorkItemDto[] {
  return (source.manualTasks ?? []).map((task) => {
    const overdue = task.dueAt < source.now;
    const urgent = task.priority === 'HIGH' || task.priority === 'CRITICAL';
    return {
      id: `manual-task:${task.id}`,
      kind: 'MANUAL_TASK',
      scheduledAt: task.dueAt.toISOString(),
      title: task.title,
      tone: overdue || task.priority === 'CRITICAL' ? 'danger' : urgent ? 'warning' : 'info',
      href: task.href ?? '/',
      vehicleLabel: task.description ?? 'Ручная задача',
      clientLabel: task.assignedToName ? `Ответственный: ${task.assignedToName}` : null,
      phone: null,
      contractNumber: null,
      address: null,
      amountMinor: null,
      overdue,
      completable: true,
    };
  });
}

function leadWorkItems(source: DashboardOverviewSource): DashboardWorkItemDto[] {
  return (source.leads ?? []).flatMap((lead) => {
    const scheduledAt = lead.nextContactAt;
    if (
      scheduledAt &&
      !occursIn(scheduledAt, source.period) &&
      !isVisibleOverdue(scheduledAt, source)
    ) {
      return [];
    }

    const overdue = scheduledAt !== null && scheduledAt < source.now;
    const fullName = [lead.lastName, lead.name].filter(Boolean).join(' ');
    return [
      {
        id: `lead:${lead.id}`,
        kind: 'LEAD' as const,
        scheduledAt: (scheduledAt ?? lead.createdAt).toISOString(),
        title: 'Связаться по заявке',
        tone: overdue ? ('danger' as const) : ('info' as const),
        href: '/leads',
        vehicleLabel: fullName,
        clientLabel: lead.source ? `Источник: ${lead.source}` : 'Источник не указан',
        phone: lead.phone,
        contractNumber: null,
        address: null,
        amountMinor: null,
        overdue,
        unscheduled: scheduledAt === null,
      },
    ];
  });
}

function fineWorkItems(source: DashboardOverviewSource): DashboardWorkItemDto[] {
  return (source.fines ?? [])
    .filter((fine) => !['PAID', 'CANCELLED'].includes(fine.status ?? ''))
    .map((fine) => {
      const discount =
        fine.discountExpiresAt && fine.discountExpiresAt >= source.now
          ? fine.discountExpiresAt
          : null;
      const discountToday = discount && comparePilotBusinessDate(discount, source.now) === 0;
      const overdue = fine.status === 'OVERDUE';
      return {
        id: `fine:${fine.id}`,
        kind: 'FINE',
        scheduledAt: (discount ?? fine.createdAt).toISOString(),
        title: discountToday
          ? 'Скидка заканчивается сегодня'
          : overdue
            ? 'Просроченный штраф'
            : fine.status === 'UNPAID'
              ? 'Неоплаченный штраф'
              : 'Новый штраф',
        tone: 'warning' as const,
        href: `/fines?query=${encodeURIComponent(fine.decreeNumber)}`,
        vehicleLabel: fine.vehicleLabel ?? 'Автомобиль не определён',
        clientLabel: fine.clientLabel ?? 'Клиент не определён',
        phone: null,
        contractNumber: fine.contractNumber,
        address: fine.address,
        amountMinor: fine.currentAmountMinor.toString(),
        overdue,
        unscheduled: !discount && !overdue,
        dateOnly: Boolean(discount),
        deadlineLabel: discountToday
          ? 'Скидка заканчивается сегодня'
          : discount
            ? 'Окончание скидки'
            : 'Срок оплаты не указан',
      };
    });
}

function lowFuelWorkItems(source: DashboardOverviewSource): DashboardWorkItemDto[] {
  if (source.now < source.period.from || source.now >= source.period.toExclusive) return [];

  return source.vehicles.flatMap((vehicle) => {
    if (!isLowFuelLevel(vehicle.fuelLevelPercent)) return [];
    const fuelLevelPercent = Math.round(vehicle.fuelLevelPercent as number);
    return [
      {
        id: `low-fuel:${vehicle.id}`,
        kind: 'LOW_FUEL' as const,
        scheduledAt: source.now.toISOString(),
        title: 'Мало топлива',
        tone: 'danger' as const,
        href: `/vehicles/${vehicle.id}`,
        vehicleLabel: vehicle.label,
        clientLabel: `Остаток топлива: ${fuelLevelPercent}%`,
        phone: null,
        contractNumber: null,
        address: null,
        amountMinor: null,
        overdue: false,
      },
    ];
  });
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
  const lowFuel = workItems
    .filter((item) => item.kind === 'LOW_FUEL')
    .map((item) => ({
      id: item.id,
      tone: 'warning' as const,
      title: 'Нужна заправка',
      description: `${item.vehicleLabel}. ${item.clientLabel}`,
      href: item.href,
    }));
  return [...overdueItems, ...lowFuel, ...offlineVehicles].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

export function buildDashboardOverview(source: DashboardOverviewSource): DashboardOverviewDto {
  const companyVehicles = source.vehicles.filter(isCompanyRealVehicle);
  const realVehicleIds = new Set(companyVehicles.map((vehicle) => vehicle.id));
  const rentals = source.rentals.filter((rental) => realVehicleIds.has(rental.vehicleId));
  const maintenanceRecords = source.maintenanceRecords.filter((record) =>
    realVehicleIds.has(record.vehicleId),
  );
  const washRecords = source.washRecords.filter((record) => realVehicleIds.has(record.vehicleId));
  const companySource: DashboardOverviewSource = {
    ...source,
    vehicles: companyVehicles,
    rentals,
    maintenanceRecords,
    washRecords,
  };
  const activeMaintenanceRecords = maintenanceRecords.filter((record) => {
    if (!['PLANNED', 'IN_PROGRESS', 'DAMAGE_REPORTED', 'WAITING_REPAIR'].includes(record.status)) {
      return false;
    }
    const startsAt =
      record.recordType === 'REPAIR'
        ? (record.damageReportedAt ?? record.scheduledAt)
        : record.scheduledAt;
    return Boolean(startsAt && overlaps(startsAt, record.scheduledEndsAt, source.period));
  });
  const maintenanceVehicleIds = new Set(
    activeMaintenanceRecords
      .filter((record) => record.recordType === 'MAINTENANCE')
      .map((record) => record.vehicleId),
  );
  const repairVehicleIds = new Set(
    activeMaintenanceRecords
      .filter((record) => record.recordType === 'REPAIR')
      .map((record) => record.vehicleId),
  );
  const washVehicleIds = new Set(
    washRecords
      .filter(
        (record) =>
          ['PLANNED', 'IN_PROGRESS'].includes(record.status) &&
          overlaps(record.scheduledAt, record.completedAt ?? null, source.period),
      )
      .map((record) => record.vehicleId),
  );
  const serviceVehicleIds = new Set([
    ...maintenanceVehicleIds,
    ...repairVehicleIds,
    ...washVehicleIds,
  ]);
  const occupiedVehicleIds = new Set(
    rentals
      .filter(
        (rental) =>
          ['CONFIRMED', 'ACTIVE'].includes(rental.status) &&
          (overlaps(rental.startsAt, rental.endsAt, source.period) ||
            (rental.status === 'ACTIVE' &&
              rental.startsAt < source.period.toExclusive &&
              isVisibleOverdue(rental.endsAt, companySource))),
      )
      .map((rental) => rental.vehicleId),
  );
  const workSource = { ...companySource, period: source.workPeriod ?? source.period };
  const workItems = [
    ...rentals.flatMap((rental) => rentalWorkItems(rental, workSource)),
    ...serviceWorkItems(workSource),
    ...manualTaskWorkItems(workSource),
    ...leadWorkItems(workSource),
    ...fineWorkItems(workSource),
    ...lowFuelWorkItems(workSource),
  ].sort(
    (left, right) =>
      Number(right.overdue) - Number(left.overdue) ||
      Number(Boolean(left.unscheduled)) - Number(Boolean(right.unscheduled)) ||
      left.scheduledAt.localeCompare(right.scheduledAt) ||
      left.id.localeCompare(right.id),
  );
  const offlineVehicles = companyVehicles.filter(
    (vehicle) =>
      !vehicle.position ||
      source.now.getTime() - vehicle.position.recordedAt.getTime() > OFFLINE_AFTER_MS,
  ).length;
  const earnedMinor = rentals.reduce(
    (total, rental) => total + allocatedRentalEarnedMinor(rental, source.period),
    BigInt(0),
  );
  const financeRentals = (source.financeRentals ?? rentals).filter(
    (rental) => rental.status !== 'DRAFT' && rental.status !== 'CANCELLED',
  );
  const lifetimeEarnedMinor = financeRentals.reduce(
    (total, rental) =>
      total +
      rental.totalPriceMinor +
      rental.operations.reduce(
        (operationTotal, operation) =>
          operation.status === 'COMMITTED' && operation.type === 'EXTENSION'
            ? operationTotal + (operation.extensionChargeMinor ?? BigInt(0))
            : operationTotal,
        BigInt(0),
      ),
    BigInt(0),
  );
  const lifetimeDepositsMinor = financeRentals.reduce(
    (total, rental) => total + (rental.depositMinor ?? BigInt(0)),
    BigInt(0),
  );
  const heldDepositsMinor = financeRentals.reduce((total, rental) => {
    const depositStatus = resolveRentalDepositState({
      expectedMinor: rental.depositMinor,
      operations: rental.operations,
      payments: rental.payments ?? [],
    });
    // A terminal settlement accounts for both the refund and any retention.
    // Confirmed deposit payments remain in the ledger as historical receipts.
    if (depositStatus && ['RETURNED', 'PARTIALLY_WITHHELD', 'WITHHELD'].includes(depositStatus)) {
      return total;
    }
    const received = (rental.payments ?? []).reduce(
      (sum, payment) =>
        payment.kind === 'DEPOSIT' && payment.status === 'CONFIRMED'
          ? sum + payment.amountMinor
          : sum,
      BigInt(0),
    );
    // Older contracts can confirm receipt through a handover instead of a payment.
    return (
      total +
      (received > BigInt(0)
        ? received
        : depositStatus === 'COLLECTED'
          ? (rental.depositMinor ?? BigInt(0))
          : BigInt(0))
    );
  }, BigInt(0));
  const serviceVehicles = companyVehicles.filter((vehicle) =>
    serviceVehicleIds.has(vehicle.id),
  ).length;
  const occupiedVehicles = companyVehicles.filter(
    (vehicle) => !serviceVehicleIds.has(vehicle.id) && occupiedVehicleIds.has(vehicle.id),
  ).length;

  return {
    generatedAt: source.now.toISOString(),
    period: {
      key: source.period.key,
      label: source.period.label,
      from: source.period.from.toISOString(),
      toExclusive: source.period.toExclusive.toISOString(),
    },
    kpis: {
      earnedMinor: earnedMinor.toString(),
      earnedIsEstimated: true,
      lifetimeEarnedMinor: lifetimeEarnedMinor.toString(),
      lifetimeDepositsMinor: lifetimeDepositsMinor.toString(),
      heldDepositsMinor: heldDepositsMinor.toString(),
      freeVehicles: companyVehicles.length - serviceVehicles - occupiedVehicles,
      occupiedVehicles,
      serviceVehicles,
      maintenanceVehicles: maintenanceVehicleIds.size,
      repairVehicles: repairVehicleIds.size,
      washVehicles: washVehicleIds.size,
      contracts: financeRentals.length,
      clients: source.clientCount,
      offlineVehicles,
    },
    workItems,
    attentionItems: attentionItems(workItems, companyVehicles, source.now),
  };
}
