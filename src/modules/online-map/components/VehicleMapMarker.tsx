'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { FiTruck } from 'react-icons/fi';

import type { OnlineMapStatus, OnlineMapVehicle } from '../types';

const statusColors: Record<OnlineMapStatus, string> = {
  moving: 'bg-[var(--color-success)]',
  idle: 'bg-[var(--color-warning)]',
  offline: 'bg-[var(--color-text-secondary)]',
};

const statusLabels: Record<OnlineMapStatus, string> = {
  moving: 'В движении',
  idle: 'На стоянке',
  offline: 'Нет связи',
};

interface VehicleMapMarkerProps {
  vehicle: OnlineMapVehicle;
  selected: boolean;
  onSelect: (vehicle: OnlineMapVehicle) => void;
}

export function VehicleMapMarker({ vehicle, selected, onSelect }: VehicleMapMarkerProps) {
  const prefersReducedMotion = useReducedMotion();
  const hoverAnimation = prefersReducedMotion ? {} : { scale: 1.05, y: -4 };

  return (
    <button
      type="button"
      aria-label={`Выбрать автомобиль ${vehicle.plate}`}
      aria-pressed={selected}
      data-selected={selected}
      className="group relative grid size-11 place-items-center rounded-[var(--radius-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      onClick={() => onSelect(vehicle)}
    >
      <motion.div
        whileHover={hoverAnimation}
        whileFocus={hoverAnimation}
        transition={{ duration: 0.2 }}
        className="grid size-10 place-items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] shadow-[var(--shadow-floating)] motion-reduce:transform-none"
      >
        <FiTruck aria-hidden="true" className="size-5" />
        <span
          aria-label={statusLabels[vehicle.status]}
          className={`absolute right-0.5 bottom-0.5 size-2.5 rounded-full border-2 border-[var(--color-surface)] ${statusColors[vehicle.status]}`}
        />
      </motion.div>

      <span
        className={`pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-52 -translate-x-1/2 rounded-[var(--radius-sm)] border bg-[var(--color-surface)] px-2.5 py-2 text-left text-xs text-[var(--color-text)] shadow-[var(--shadow-floating)] ${selected ? 'block' : 'hidden group-focus-within:block group-hover:block'}`}
      >
        <span className="block font-semibold">{vehicle.plate}</span>
        <span className="block text-[var(--color-text-secondary)]">
          {vehicle.name} · {statusLabels[vehicle.status]}
        </span>
      </span>
    </button>
  );
}
