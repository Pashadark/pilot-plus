'use client';

import dynamic from 'next/dynamic';

import type { OnlineFleetMapProps } from './OnlineFleetMap';
import styles from './OnlineFleetMap.module.css';

const OnlineFleetMapCanvas = dynamic(
  () => import('./OnlineFleetMap').then((module) => module.OnlineFleetMap),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-label="Карта загружается"
        className={`${styles.mapLoadingPattern} h-full min-h-96`}
      />
    ),
  },
);

export function OnlineFleetMapClient(props: OnlineFleetMapProps) {
  return <OnlineFleetMapCanvas {...props} />;
}
