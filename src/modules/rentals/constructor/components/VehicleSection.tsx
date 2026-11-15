'use client';

import { FiAlertTriangle, FiCheck, FiTruck } from 'react-icons/fi';

import { intervalsOverlap } from '@/modules/rentals/domain/availability';
import { moscowLocalToUtc } from '@/modules/rentals/domain/calculate-rental';

import type {
  RentalConstructorBootstrap,
  RentalConstructorVehicleOption,
} from '../server/bootstrap';

function rubles(minor: number) {
  return `${Math.round(minor / 100)
    .toLocaleString('ru-RU')
    .replaceAll('\u00a0', ' ')} ₽/сутки`;
}

export function vehicleSelectionStatus(
  vehicle: RentalConstructorVehicleOption,
  startsAt?: string,
  endsAt?: string,
) {
  const reasons = [...vehicle.reasons];
  if (startsAt && endsAt) {
    try {
      const period: [Date, Date] = [moscowLocalToUtc(startsAt), moscowLocalToUtc(endsAt)];
      const overlap = vehicle.rentalIntervals?.some(
        (rental) =>
          (rental.status === 'CONFIRMED' || rental.status === 'ACTIVE') &&
          intervalsOverlap([new Date(rental.startsAt), new Date(rental.endsAt)], period),
      );
      if (overlap) reasons.push('Занят подтверждённой арендой');
    } catch {
      // The terms section owns date validation; vehicle cards remain usable meanwhile.
    }
  }
  return { available: vehicle.available && reasons.length === 0, reasons };
}

export function VehicleSection({
  vehicles,
  selectedId,
  startsAt,
  endsAt,
  onSelected,
}: {
  vehicles: RentalConstructorBootstrap['vehicles'];
  selectedId?: string;
  startsAt?: string;
  endsAt?: string;
  onSelected(vehicle: RentalConstructorVehicleOption, available: boolean): void;
}) {
  return (
    <section className="grid gap-4" aria-labelledby="constructor-vehicle-title">
      <div>
        <h2 id="constructor-vehicle-title" className="text-lg font-bold">
          Автомобиль
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Доступность учитывает сервис, мойку и пересечения с действующими арендами.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {vehicles.map((vehicle) => {
          const selection = vehicleSelectionStatus(vehicle, startsAt, endsAt);
          const selected = vehicle.id === selectedId;
          const blockers = vehicle.readiness?.blockers ?? [];
          return (
            <button
              key={vehicle.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelected(vehicle, selection.available)}
              className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-left transition-[border-color,box-shadow] hover:border-[var(--color-border-strong)] aria-pressed:border-[var(--color-primary)] aria-pressed:shadow-[var(--shadow-card)]"
            >
              <div
                className="relative grid aspect-[16/8] place-items-center bg-[var(--color-elevated)] bg-cover bg-center"
                style={vehicle.imageUrl ? { backgroundImage: `url(${vehicle.imageUrl})` } : undefined}
                role="img"
                aria-label={
                  vehicle.imageUrl
                    ? `Фотография ${vehicle.label}`
                    : `Фотография ${vehicle.label} отсутствует`
                }
              >
                {!vehicle.imageUrl ? (
                  <FiTruck aria-hidden className="size-9 text-[var(--color-text-tertiary)]" />
                ) : null}
                {selected ? (
                  <span className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-[var(--color-primary)] text-white shadow-lg">
                    <FiCheck aria-hidden />
                  </span>
                ) : null}
              </div>
              <div className="grid gap-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <b className="block truncate text-sm">{vehicle.label}</b>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {vehicle.registrationNumber ?? 'Номер не указан'}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-[var(--color-primary)]">
                    {rubles(vehicle.dailyMinor)}
                  </span>
                </div>
                {selection.reasons.map((reason) => (
                  <span
                    key={reason}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-danger)]"
                  >
                    <FiAlertTriangle aria-hidden /> {reason}
                  </span>
                ))}
                {blockers.map((blocker) => (
                  <span
                    key={blocker.code}
                    className="flex items-center gap-1.5 text-xs text-[var(--color-warning)]"
                  >
                    <FiAlertTriangle aria-hidden /> {blocker.message}
                  </span>
                ))}
                {selection.available && blockers.length === 0 ? (
                  <span className="text-xs font-semibold text-[var(--color-success)]">
                    Готов к аренде
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
        {!vehicles.length ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-4 text-sm text-[var(--color-text-secondary)] md:col-span-2">
            В выбранной компании нет доступных автомобилей.
          </p>
        ) : null}
      </div>
    </section>
  );
}
