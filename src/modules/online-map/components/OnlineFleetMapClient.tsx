'use client';

import dynamic from 'next/dynamic';

import type { OnlineFleetMapProps } from './OnlineFleetMap';

const OnlineFleetMapCanvas = dynamic(
  () => import('./OnlineFleetMap').then((module) => module.OnlineFleetMap),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-label="Карта загружается"
        className="h-full min-h-96 animate-pulse bg-[var(--color-primary-soft)] motion-reduce:animate-none"
      />
    ),
  },
);

export function OnlineFleetMapClient(props: OnlineFleetMapProps) {
  return <OnlineFleetMapCanvas {...props} />;
}
