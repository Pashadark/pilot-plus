'use client';

import { motion, useReducedMotion } from 'framer-motion';

import type { VehicleGpsStatusTone } from '@/modules/vehicles/gps-status';

import type { OnlineMapVehicle } from '../types';

const statusColors: Record<VehicleGpsStatusTone, string> = {
  success: 'text-[var(--color-success)]',
  primary: 'text-[var(--color-primary)]',
  warning: 'text-[var(--color-warning)]',
  danger: 'text-[var(--color-danger)]',
  muted: 'text-[var(--color-text-secondary)]',
};

interface VehicleMapMarkerProps {
  vehicle: OnlineMapVehicle;
  selected: boolean;
  onSelect: (vehicle: OnlineMapVehicle) => void;
}

export function VehicleMapMarker({ vehicle, selected, onSelect }: VehicleMapMarkerProps) {
  const prefersReducedMotion = useReducedMotion();
  const hoverAnimation = prefersReducedMotion ? {} : { scale: 1.04, y: -2 };
  const heading = normalizeHeading(vehicle.heading);

  return (
    <motion.button
      type="button"
      aria-label={`Выбрать автомобиль ${vehicle.plate}`}
      aria-pressed={selected}
      data-selected={selected}
      className="group relative grid size-12 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] motion-reduce:transform-none"
      onClick={() => onSelect(vehicle)}
      whileHover={hoverAnimation}
      whileFocus={hoverAnimation}
      transition={{ duration: 0.2 }}
    >
      <span
        data-testid="vehicle-map-arrow"
        data-heading={String(heading)}
        aria-label={vehicle.gpsStatus.label}
        className={`grid size-10 place-items-center transition-[transform,filter] duration-200 ease-out motion-reduce:transition-none ${
          selected ? 'text-[var(--color-primary)]' : statusColors[vehicle.gpsStatus.tone]
        } ${
          selected
            ? 'drop-shadow-[0_0_7px_color-mix(in_srgb,var(--color-primary)_55%,transparent)]'
            : 'drop-shadow-[0_2px_3px_rgba(15,23,42,0.28)]'
        }`}
        style={{ transform: `rotate(${heading}deg)` }}
      >
        <AngularDirectionArrow />
      </span>

      <span
        className={`pointer-events-none absolute bottom-full left-1/2 mb-2 hidden w-max max-w-56 -translate-x-1/2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-left text-xs text-[var(--color-text)] shadow-[var(--shadow-floating)] [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:block [@media(hover:hover)_and_(pointer:fine)]:group-hover:block ${selected ? '[@media(hover:hover)_and_(pointer:fine)]:block' : ''}`}
      >
        <span className="block font-semibold">{vehicle.plate}</span>
        <span className="block text-[var(--color-text-secondary)]">
          {vehicle.name} · {vehicle.gpsStatus.label}
        </span>
        <span className="mt-1.5 block">
          Скорость:{' '}
          {vehicle.gpsStatus.key === 'NO_DATA' || vehicle.gpsStatus.key === 'STALE'
            ? 'Нет актуальных данных'
            : vehicle.speedKph === 0
              ? 'Стоит'
              : `${vehicle.speedKph} км/ч`}
        </span>
        <span className="block">
          Топливо:{' '}
          {vehicle.fuelPercent == null ? 'Нет данных' : `${vehicle.fuelPercent}%`}
        </span>
        <span className="block">Последний сигнал: {vehicle.lastSeenLabel}</span>
      </span>
    </motion.button>
  );
}

function normalizeHeading(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return ((Math.round(value) % 360) + 360) % 360;
}

function AngularDirectionArrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="size-9 overflow-visible">
      <path
        d="M16 1 29 31 16 25 3 31Z"
        fill="currentColor"
        stroke="white"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
