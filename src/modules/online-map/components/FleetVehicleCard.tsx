'use client';

import { FiClock, FiMap, FiNavigation, FiTool } from 'react-icons/fi';

import type { OnlineMapVehicle } from '../types';

const STATUS_STRIP: Record<OnlineMapVehicle['gpsStatus']['tone'], string> = {
  success: 'bg-[var(--color-success)]',
  primary: 'bg-[var(--color-primary)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
  muted: 'bg-[var(--color-text-secondary)]',
};

const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function progressStyle(percent: number) {
  return { width: `${clampPercent(percent)}%` };
}

function splitPlate(plate: string) {
  const compact = plate.replace(/\s+/g, '').toUpperCase();
  const match = compact.match(/^(.\d{3}..)(\d{2,3})$/u);
  return match ? { main: match[1], region: match[2] } : { main: plate, region: null };
}

function VehiclePlate({ plate }: { plate: string }) {
  const parts = splitPlate(plate);
  return (
    <span className="inline-flex h-[18px] max-w-full items-stretch overflow-hidden rounded-[3px] border border-black bg-white font-sans leading-none text-black">
      <span className="flex items-center truncate border-r border-black px-1 text-[10px] font-extrabold tracking-[0.04em]">
        {parts.main}
      </span>
      {parts.region ? (
        <span className="flex w-6 flex-col items-center justify-center px-0.5">
          <span className="text-[8px] font-extrabold">{parts.region}</span>
          <span className="flex items-center gap-0.5 text-[5px] font-bold">
            RUS
            <span
              aria-hidden="true"
              className="h-[4px] w-[7px] rounded-[1px] border border-black/15 bg-[linear-gradient(to_bottom,#fff_0_33%,#0039a6_33%_66%,#d52b1e_66%)]"
            />
          </span>
        </span>
      ) : null}
    </span>
  );
}

function vehicleBadges(vehicle: OnlineMapVehicle) {
  const badges: Array<{ label: string; className: string }> = [];
  if (vehicle.gpsStatus.key === 'NO_DATA' || vehicle.gpsStatus.key === 'STALE') {
    badges.push({
      label: 'Нет актуального сигнала',
      className: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
    });
  }
  if (vehicle.fuelPercent !== null && vehicle.fuelPercent <= 20) {
    badges.push({
      label: 'Мало топлива',
      className: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
    });
  }
  if (
    vehicle.maintenance?.remainingKm !== null &&
    vehicle.maintenance?.remainingKm !== undefined &&
    vehicle.maintenance.remainingKm <= 1000
  ) {
    badges.push({
      label: 'Скоро ТО',
      className: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
    });
  }
  if (badges.length === 0) {
    badges.push({
      label: 'Всё в норме',
      className: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
    });
  }
  return badges;
}

export function FleetVehicleCard({
  vehicle,
  selected,
  dayDistanceKm,
  dayDistanceLoading,
  onSelect,
}: {
  vehicle: OnlineMapVehicle;
  selected: boolean;
  dayDistanceKm: number | null;
  dayDistanceLoading: boolean;
  onSelect: () => void;
}) {
  const maintenance = vehicle.maintenance;
  const maintenancePercent =
    maintenance?.startOdometerKm !== null &&
    maintenance?.startOdometerKm !== undefined &&
    vehicle.odometerKm !== null &&
    vehicle.odometerKm !== undefined &&
    maintenance.targetOdometerKm > maintenance.startOdometerKm
      ? ((vehicle.odometerKm - maintenance.startOdometerKm) /
          (maintenance.targetOdometerKm - maintenance.startOdometerKm)) *
        100
      : null;
  const mileageLimit =
    vehicle.currentRental?.includedMileageKm ?? vehicle.includedMileageKm ?? null;
  const mileagePercent =
    dayDistanceKm !== null && mileageLimit !== null && mileageLimit > 0
      ? (dayDistanceKm / mileageLimit) * 100
      : null;

  return (
    <button
      type="button"
      aria-label={`Выбрать ${vehicle.name} ${vehicle.plate}`}
      aria-current={selected ? 'true' : undefined}
      onClick={onSelect}
      className="group relative grid w-full gap-2 overflow-hidden rounded-[var(--radius-md)] border border-transparent bg-[var(--color-elevated)] px-3 py-2.5 pl-4 text-left text-[var(--color-text)] transition-[background-color,border-color] duration-[var(--motion-fast)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)] aria-current:border-[var(--color-primary)] aria-current:bg-[color-mix(in_srgb,var(--color-elevated)_82%,var(--color-primary)_18%)]"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-2 left-0 w-[3px] rounded-r ${selected ? 'bg-[var(--color-primary)]' : STATUS_STRIP[vehicle.gpsStatus.tone]}`}
      />

      <span className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate text-sm leading-tight font-bold">{vehicle.name}</span>
          <VehiclePlate plate={vehicle.plate} />
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap text-[var(--color-text-secondary)] uppercase">
          <FiNavigation aria-hidden="true" className="size-3" />
          {vehicle.gpsStatus.key === 'NO_DATA' || vehicle.gpsStatus.key === 'STALE'
            ? 'Нет данных'
            : vehicle.speedKph === 0
              ? 'Стоит'
              : `${vehicle.speedKph} км/ч`}
        </span>
      </span>

      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium">
          {vehicle.currentRental?.clientName ?? 'Нет активного водителя'}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
          <FiClock aria-hidden="true" className="size-3" />
          {vehicle.lastSeenLabel}
        </span>
      </span>

      <span className="flex flex-wrap gap-1">
        {vehicleBadges(vehicle).map((badge) => (
          <span
            key={badge.label}
            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${badge.className}`}
          >
            {badge.label}
          </span>
        ))}
      </span>

      <span className="grid gap-1.5 border-t border-[var(--color-border)] pt-2">
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-[var(--color-text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <FiMap aria-hidden="true" className="size-3" />
            За день{' '}
            <b className="text-[var(--color-text)]">
              {dayDistanceLoading
                ? 'Считаем…'
                : dayDistanceKm === null
                  ? 'Нет данных'
                  : `${number.format(dayDistanceKm)} км`}
            </b>
          </span>
          <span>
            Одометр{' '}
            <b className="text-[var(--color-text)]">
              {vehicle.odometerKm === null || vehicle.odometerKm === undefined
                ? 'Нет данных'
                : `${number.format(vehicle.odometerKm)} км`}
            </b>
          </span>
        </span>

        <span className="grid gap-1">
          <span className="flex justify-between gap-2 text-[9px] text-[var(--color-text-secondary)]">
            <span className="inline-flex items-center gap-1">
              <FiTool aria-hidden="true" className="size-3" />
              {maintenance?.remainingKm === null || maintenance?.remainingKm === undefined
                ? 'Нет данных по ТО'
                : `До ТО ${number.format(Math.round(maintenance.remainingKm))} км`}
            </span>
            <b>
              {maintenance ? `${number.format(maintenance.targetOdometerKm)} км` : 'План не задан'}
            </b>
          </span>
          <span
            role="progressbar"
            aria-label={`Пробег до ТО ${vehicle.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              maintenancePercent === null ? undefined : Math.round(clampPercent(maintenancePercent))
            }
            className="h-[3px] overflow-hidden rounded-full bg-[var(--color-border)]"
          >
            {maintenancePercent !== null ? (
              <span
                aria-hidden="true"
                className="block h-full rounded-full bg-[linear-gradient(90deg,var(--color-success),var(--color-warning),var(--color-danger))]"
                style={progressStyle(maintenancePercent)}
              />
            ) : null}
          </span>
        </span>

        <span className="grid gap-1">
          <span className="flex justify-between gap-2 text-[9px] text-[var(--color-text-secondary)]">
            <span>
              {mileageLimit === null ? 'Лимит не задан' : `Лимит ${number.format(mileageLimit)} км`}
            </span>
            <b>{dayDistanceKm === null ? 'Нет данных' : `${number.format(dayDistanceKm)} км`}</b>
          </span>
          <span
            role="progressbar"
            aria-label={`Дневной лимит пробега ${vehicle.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              mileagePercent === null ? undefined : Math.round(clampPercent(mileagePercent))
            }
            className="h-[3px] overflow-hidden rounded-full bg-[var(--color-border)]"
          >
            {mileagePercent !== null ? (
              <span
                aria-hidden="true"
                className="block h-full rounded-full bg-[linear-gradient(90deg,var(--color-success),var(--color-warning),var(--color-danger))]"
                style={progressStyle(mileagePercent)}
              />
            ) : null}
          </span>
        </span>
      </span>
    </button>
  );
}
