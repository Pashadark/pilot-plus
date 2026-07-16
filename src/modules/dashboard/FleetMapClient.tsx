'use client';

import dynamic from 'next/dynamic';

import type { Vehicle } from './types';

const FleetMap = dynamic(() => import('./FleetMap').then((module) => module.FleetMap), {
  ssr: false,
  loading: () => (
    <div
      className="h-full min-h-96 animate-pulse bg-[var(--color-primary-soft)]"
      aria-label="Карта загружается"
    />
  ),
});

export interface FleetMapClientProps {
  vehicles: readonly Vehicle[];
  mode: 'desktop' | 'mobile';
  onVehicleSelect?: (vehicle: Vehicle) => void;
}

export function FleetMapClient(props: FleetMapClientProps) {
  return <FleetMap {...props} />;
}
