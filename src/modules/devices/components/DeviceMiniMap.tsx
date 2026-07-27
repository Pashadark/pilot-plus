'use client';

import dynamic from 'next/dynamic';

const DeviceMiniMapCanvas = dynamic(
  () => import('./DeviceMiniMapCanvas').then((module) => module.DeviceMiniMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div
        aria-label="Карта загружается"
        className="h-56 animate-pulse bg-[var(--color-primary-soft)] sm:h-64"
      />
    ),
  },
);

export function DeviceMiniMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  return <DeviceMiniMapCanvas latitude={latitude} longitude={longitude} />;
}
