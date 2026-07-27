import Link from 'next/link';
import { FiChevronRight, FiNavigation, FiRadio, FiZap } from 'react-icons/fi';

import type { DeviceListItem } from '../types';
import { Card } from '@/shared/ui';

import { DeviceStatusBadge } from './DeviceStatusBadge';

function formatLastSeen(lastSeenAt: string | null) {
  if (!lastSeenAt) return 'Нет данных';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  }).format(new Date(lastSeenAt));
}

export function DeviceCard({ device }: { device: DeviceListItem }) {
  const connection =
    device.connectionType === 'NONE'
      ? 'Нет связи'
      : [
          device.connectionType,
          device.mobileOperator,
          device.signalStrength === null ? null : `${device.signalStrength}%`,
        ]
          .filter(Boolean)
          .join(' · ');
  const power = device.powerSource === 'VEHICLE' ? 'От автомобиля' : 'Аккумулятор';

  return (
    <Card className="min-w-0 p-4" data-testid="device-mobile-card">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/devices/${device.id}`}
            className="block font-semibold break-words hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            {device.name}
          </Link>
          <p className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">
            {device.serialNumber}
          </p>
        </div>
        <DeviceStatusBadge status={device.effectiveStatus} />
      </div>
      <dl className="mt-4 grid min-w-0 gap-3 text-sm">
        <div className="grid gap-0.5">
          <dt className="text-[var(--color-text-secondary)]">Автомобиль</dt>
          <dd className="break-words">{device.vehicle?.label ?? 'Не привязано'}</dd>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <dt className="flex items-center gap-1 text-[var(--color-text-secondary)]">
              <FiRadio aria-hidden="true" /> Связь
            </dt>
            <dd className="mt-0.5 break-words">{connection}</dd>
          </div>
          <div className="min-w-0">
            <dt className="flex items-center gap-1 text-[var(--color-text-secondary)]">
              <FiNavigation aria-hidden="true" /> ГЛОНАСС
            </dt>
            <dd className="mt-0.5">
              {device.satellitesCount === null ? 'Нет данных' : `${device.satellitesCount} спутн.`}
            </dd>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <dt className="flex items-center gap-1 text-[var(--color-text-secondary)]">
              <FiZap aria-hidden="true" /> Питание
            </dt>
            <dd className="mt-0.5 break-words">
              {power}
              {device.batteryLevel === null ? '' : ` · ${device.batteryLevel}%`}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[var(--color-text-secondary)]">Прошивка</dt>
            <dd className="mt-0.5">
              {device.firmwareVersion}
              {device.updateAvailable ? ' · обновление' : ''}
            </dd>
          </div>
        </div>
        <div>
          <dt className="text-[var(--color-text-secondary)]">Последняя связь</dt>
          <dd className="mt-0.5">{formatLastSeen(device.lastSeenAt)}</dd>
        </div>
      </dl>
      <Link
        href={`/devices/${device.id}`}
        className="mt-4 flex min-h-11 items-center justify-between rounded-[var(--radius-sm)] px-1 font-medium text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
      >
        Открыть устройство <FiChevronRight aria-hidden="true" />
      </Link>
    </Card>
  );
}
