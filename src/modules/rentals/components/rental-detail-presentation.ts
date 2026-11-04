import { vehicleName } from '@/shared/lib/vehicle-name';
import { resolveRentalMileagePolicy } from '../domain/mileage-policy';
export type RentalStatus = 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type RentalDetailInput = {
  id: string;
  contractNumber: string | null;
  status: RentalStatus;
  agreementType: 'STANDARD' | 'LEASE_TO_OWN';
  snapshot: unknown;
  clientId: string;
  clientLabel: string;
  vehicleId: string;
  vehicleLabel: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  activatedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  currency: string;
  dailyRateMinor: bigint;
  billableDays: number;
  basePriceMinor: bigint;
  discountMinor: bigint;
  servicesMinor: bigint;
  totalPriceMinor: bigint;
  depositMinor: bigint | null;
  includedMileageKm: number | null;
  overageMileagePriceMinor: bigint | null;
  missingFuelPriceMinor: bigint | null;
  priceOverrideReason: string | null;
  drivers: readonly { id: string; label: string }[];
};

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type RentalDetailView = {
  id: string;
  contractNumber: string;
  status: { label: string; tone: StatusTone };
  source: { label: string; description: string };
  client: { id: string; label: string };
  vehicle: { id: string; label: string };
  term: { startsAt: string; endsAt: string; billableDaysLabel: string };
  finance: Record<
    'dailyRate' | 'basePrice' | 'discount' | 'services' | 'total' | 'deposit',
    string
  > & { priceOverrideReason: string };
  operations: {
    includedMileage: string;
    overagePrice: string;
    missingFuelPrice: string;
    pickupAddress: string;
    returnAddress: string;
    startMileage: string;
    returnMileage: string;
    startFuel: string;
    returnFuel: string;
    territory: string;
    paymentTerms: string;
    allowedDrivers: readonly string[];
    conditions: string;
  };
  lifecycle: readonly { key: string; label: string; occurredAt: string }[];
};

const statusPresentation: Record<RentalStatus, RentalDetailView['status']> = {
  DRAFT: { label: 'Черновик', tone: 'neutral' },
  CONFIRMED: { label: 'Подтверждён', tone: 'info' },
  ACTIVE: { label: 'Активен', tone: 'warning' },
  COMPLETED: { label: 'Завершён', tone: 'success' },
  CANCELLED: { label: 'Отменён', tone: 'danger' },
};

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function display(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return optionalText(value) ?? 'Не указано';
}

function date(value: unknown): string {
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(parsed)
    : 'Не указано';
}

function safeMinor(value: unknown, fallback: bigint | null): bigint | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/u.test(value)) return BigInt(value);
  return fallback;
}

function money(value: bigint | null, currency: string): string {
  if (value === null) return 'Не указано';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: currency.trim() || 'RUB',
    maximumFractionDigits: 0,
  }).format(Number(value) / 100);
}

function daysLabel(value: number): string {
  const remainder100 = value % 100;
  const remainder10 = value % 10;
  const word =
    remainder100 >= 11 && remainder100 <= 14
      ? 'дней'
      : remainder10 === 1
        ? 'день'
        : remainder10 >= 2 && remainder10 <= 4
          ? 'дня'
          : 'дней';
  return `${value} ${word}`;
}

function vehicleLabel(vehicle: Record<string, unknown>, fallback: string): string {
  const parts = [
    vehicleName(optionalText(vehicle.make), optionalText(vehicle.model)),
    optionalText(vehicle.registrationNumber),
  ].filter((value): value is string => Boolean(value));
  return parts.length ? parts.join(' · ') : fallback;
}

function allowedDrivers(value: unknown, fallback: readonly { label: string }[]): readonly string[] {
  const configured = optionalText(value);
  if (configured)
    return configured
      .split(/[,;\n]/u)
      .map((item) => item.trim())
      .filter(Boolean);
  return fallback.map(({ label }) => label).filter(Boolean);
}

export function rentalDetailPresentation(detail: RentalDetailInput): RentalDetailView {
  const snapshot = object(detail.snapshot);
  const clientSnapshot = object(snapshot?.client);
  const vehicleSnapshot = object(snapshot?.vehicle);
  const rentalSnapshot = object(snapshot?.rental);
  const issuance = object(snapshot?.issuance);
  const imported = Boolean(optionalText(snapshot?.importedFrom));
  const immutable =
    detail.status !== 'DRAFT' && Boolean(clientSnapshot && vehicleSnapshot && rentalSnapshot);

  const startsAt = immutable ? rentalSnapshot?.startsAt : detail.startsAt;
  const endsAt = immutable ? rentalSnapshot?.endsAt : detail.endsAt;
  const snapshotDays = rentalSnapshot?.days;
  const billableDays =
    typeof snapshotDays === 'number' && Number.isSafeInteger(snapshotDays) && snapshotDays > 0
      ? snapshotDays
      : detail.billableDays;
  const currency = optionalText(rentalSnapshot?.currency) ?? detail.currency;
  const snapshotMileage = vehicleSnapshot?.includedMileageKm;
  const mileagePolicy = resolveRentalMileagePolicy({
    agreementType: detail.agreementType,
    billableDays,
    includedMileageKm:
      typeof snapshotMileage === 'number' ? snapshotMileage : detail.includedMileageKm,
  });

  const lifecycle = [
    { key: 'created', label: 'Договор создан', occurredAt: detail.createdAt },
    detail.confirmedAt
      ? { key: 'confirmed', label: 'Договор подтверждён', occurredAt: detail.confirmedAt }
      : null,
    detail.activatedAt
      ? { key: 'activated', label: 'Автомобиль выдан', occurredAt: detail.activatedAt }
      : null,
    detail.completedAt
      ? { key: 'completed', label: 'Аренда завершена', occurredAt: detail.completedAt }
      : null,
    detail.cancelledAt
      ? { key: 'cancelled', label: 'Договор отменён', occurredAt: detail.cancelledAt }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    id: detail.id,
    contractNumber: detail.contractNumber ?? 'Черновик договора',
    status: statusPresentation[detail.status],
    source: imported
      ? {
          label: 'Импортированный договор',
          description: 'Карточка собрана из сохранённых данных исходного договора.',
        }
      : immutable
        ? {
            label: 'Снимок подтверждённого договора',
            description: 'Юридические условия зафиксированы на момент подтверждения.',
          }
        : {
            label: 'Текущие данные черновика',
            description: 'Условия ещё можно изменить до подтверждения договора.',
          },
    client: {
      id: detail.clientId,
      label: immutable
        ? (optionalText(clientSnapshot?.fullName) ?? detail.clientLabel)
        : detail.clientLabel,
    },
    vehicle: {
      id: detail.vehicleId,
      label:
        immutable && vehicleSnapshot
          ? vehicleLabel(vehicleSnapshot, detail.vehicleLabel)
          : detail.vehicleLabel,
    },
    term: {
      startsAt: date(startsAt),
      endsAt: date(endsAt),
      billableDaysLabel: daysLabel(billableDays),
    },
    finance: {
      dailyRate: money(safeMinor(vehicleSnapshot?.dailyMinor, detail.dailyRateMinor), currency),
      basePrice: money(
        safeMinor(rentalSnapshot?.calculatedTotalMinor, detail.basePriceMinor),
        currency,
      ),
      discount: money(safeMinor(rentalSnapshot?.discountMinor, detail.discountMinor), currency),
      services: money(safeMinor(rentalSnapshot?.servicesMinor, detail.servicesMinor), currency),
      total: money(safeMinor(rentalSnapshot?.agreedTotalMinor, detail.totalPriceMinor), currency),
      deposit: money(safeMinor(rentalSnapshot?.depositMinor, detail.depositMinor), currency),
      priceOverrideReason: detail.priceOverrideReason ?? 'Не указано',
    },
    operations: {
      includedMileage:
        mileagePolicy.dailyLimitKm === null || mileagePolicy.totalLimitKm === null
          ? 'Без лимита'
          : `${mileagePolicy.dailyLimitKm} км/день · ${mileagePolicy.totalLimitKm} км за ${daysLabel(mileagePolicy.billableDays)}`,
      overagePrice: money(
        safeMinor(vehicleSnapshot?.overageMileagePriceMinor, detail.overageMileagePriceMinor),
        currency,
      ),
      missingFuelPrice: money(
        safeMinor(vehicleSnapshot?.missingFuelPriceMinor, detail.missingFuelPriceMinor),
        currency,
      ),
      pickupAddress: display(issuance?.pickupAddress ?? rentalSnapshot?.pickupAddress),
      returnAddress: display(issuance?.returnAddress ?? rentalSnapshot?.returnAddress),
      startMileage: display(issuance?.startMileageKm),
      returnMileage: display(issuance?.returnMileageKm),
      startFuel:
        issuance?.startFuelPercent === undefined
          ? 'Не указано'
          : `${display(issuance.startFuelPercent)}%`,
      returnFuel:
        issuance?.returnFuelPercent === undefined
          ? 'Не указано'
          : `${display(issuance.returnFuelPercent)}%`,
      territory: display(issuance?.territory),
      paymentTerms: display(issuance?.paymentTerms),
      allowedDrivers: allowedDrivers(issuance?.allowedDrivers, detail.drivers),
      conditions: display(rentalSnapshot?.conditions),
    },
    lifecycle,
  };
}
