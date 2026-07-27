import Link from 'next/link';
import { FiMoreHorizontal } from 'react-icons/fi';

import type { DeviceListItem } from '../types';
import { DropdownMenu, EmptyState } from '@/shared/ui';

import { DeviceStatusBadge } from './DeviceStatusBadge';

function formatLastSeen(lastSeenAt: string | null) {
  if (!lastSeenAt) return 'Нет данных';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  }).format(new Date(lastSeenAt));
}

function connectionLabel(device: DeviceListItem) {
  if (device.connectionType === 'NONE') return 'Нет связи';
  const signal = device.signalStrength === null ? 'нет данных' : `${device.signalStrength}%`;
  return [device.connectionType, device.mobileOperator, signal].filter(Boolean).join(' · ');
}

function powerLabel(device: DeviceListItem) {
  const source = device.powerSource === 'VEHICLE' ? 'От автомобиля' : 'Аккумулятор';
  return device.batteryLevel === null ? source : `${source} · ${device.batteryLevel}%`;
}

function DeviceActions({ device }: { device: DeviceListItem }) {
  return (
    <DropdownMenu
      ariaLabel={`Действия устройства ${device.name}`}
      label={<FiMoreHorizontal aria-hidden="true" className="mx-auto size-5" />}
    >
      <Link
        href={`/devices/${device.id}`}
        role="menuitem"
        className="flex min-h-11 items-center rounded-[var(--radius-sm)] px-3 text-sm font-medium hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
      >
        Открыть устройство
      </Link>
      <span className="block px-3 py-2 text-xs text-[var(--color-text-secondary)]">
        Управление командами доступно в карточке устройства.
      </span>
    </DropdownMenu>
  );
}

export function DeviceTable({ devices }: { devices: readonly DeviceListItem[] }) {
  if (!devices.length) {
    return (
      <div className="p-4">
        <EmptyState
          title="Устройства не найдены"
          description="Измените условия поиска или сбросьте выбранные фильтры."
        />
      </div>
    );
  }

  return (
    <table className="w-full min-w-[76rem] border-collapse text-left text-sm">
      <thead className="bg-[var(--color-elevated)] text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
        <tr>
          <th scope="col" className="px-4 py-3 font-semibold">
            Устройство
          </th>
          <th scope="col" className="px-4 py-3 font-semibold">
            Автомобиль
          </th>
          <th scope="col" className="px-4 py-3 font-semibold">
            Прошивка
          </th>
          <th scope="col" className="px-4 py-3 font-semibold">
            Связь
          </th>
          <th scope="col" className="px-4 py-3 font-semibold">
            ГЛОНАСС
          </th>
          <th scope="col" className="px-4 py-3 font-semibold">
            Питание
          </th>
          <th scope="col" className="px-4 py-3 font-semibold">
            Последняя связь
          </th>
          <th scope="col" className="px-4 py-3 font-semibold">
            Статус
          </th>
          <th scope="col" className="px-4 py-3 font-semibold">
            <span className="sr-only">Действия</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--color-border)]">
        {devices.map((device) => (
          <tr key={device.id} className="align-top" data-testid="device-row">
            <th scope="row" className="max-w-64 px-4 py-4 font-semibold">
              <Link
                href={`/devices/${device.id}`}
                className="hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
              >
                {device.name}
              </Link>
              <span className="mt-1 block font-mono text-xs font-normal text-[var(--color-text-secondary)]">
                {device.serialNumber}
              </span>
            </th>
            <td className="max-w-60 px-4 py-4 break-words">
              {device.vehicle?.label ?? 'Не привязано'}
            </td>
            <td className="px-4 py-4 whitespace-nowrap">
              {device.firmwareVersion}
              {device.updateAvailable ? (
                <span className="mt-1 block text-xs text-[var(--color-primary)]">
                  Доступно обновление
                </span>
              ) : null}
            </td>
            <td className="max-w-48 px-4 py-4 break-words">{connectionLabel(device)}</td>
            <td className="px-4 py-4 whitespace-nowrap">
              {device.satellitesCount === null ? 'Нет данных' : `${device.satellitesCount} спутн.`}
            </td>
            <td className="max-w-44 px-4 py-4 break-words">{powerLabel(device)}</td>
            <td className="px-4 py-4 whitespace-nowrap">{formatLastSeen(device.lastSeenAt)}</td>
            <td className="px-4 py-4">
              <DeviceStatusBadge status={device.effectiveStatus} />
            </td>
            <td className="px-4 py-4">
              <DeviceActions device={device} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
