'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FiActivity,
  FiArrowLeft,
  FiBatteryCharging,
  FiCpu,
  FiMapPin,
  FiNavigation,
  FiRadio,
  FiZap,
} from 'react-icons/fi';

import type { DeviceDetails } from '../types';
import { DeviceStatusBadge } from './DeviceStatusBadge';
import { DeviceBindingDialog } from './DeviceBindingDialog';
import { DeviceCommandDialog } from './DeviceCommandDialog';
import { DeviceCommandHistory } from './DeviceCommandHistory';
import { DeviceMiniMap } from './DeviceMiniMap';
import { Badge, Card, CardContent, CardHeader } from '@/shared/ui';

function formatDate(value: string | null) {
  if (!value) return 'Нет данных';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  }).format(new Date(value));
}

function formatNumber(value: number, unit: string) {
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ${unit}`;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[var(--color-border)] py-3 last:border-0">
      <dt className="text-sm text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
    </div>
  );
}

export function DeviceDetailPage({
  device,
  availableVehicles,
}: {
  device: DeviceDetails;
  availableVehicles: readonly { id: string; label: string }[];
}) {
  const router = useRouter();
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
  const glonass =
    device.satellitesCount === null
      ? 'Нет данных'
      : `${device.satellitesCount}${
          device.positionAccuracyMeters === null
            ? ''
            : ` · точность ${formatNumber(device.positionAccuracyMeters, 'м')}`
        }`;
  const power = [
    device.powerSource === 'VEHICLE' ? 'От автомобиля' : 'Аккумулятор',
    device.externalVoltage === null ? null : formatNumber(device.externalVoltage, 'В'),
    device.batteryLevel === null ? null : `${device.batteryLevel}%`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="device-detail-page">
      <Link
        href="/devices"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      >
        <FiArrowLeft aria-hidden="true" /> К устройствам
      </Link>
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <FiCpu aria-hidden="true" className="size-6" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight break-words sm:text-3xl">
                  {device.name}
                </h1>
                <DeviceStatusBadge status={device.effectiveStatus} />
              </div>
              <p className="mt-1 font-mono text-sm text-[var(--color-text-secondary)]">
                {device.serialNumber}
              </p>
            </div>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Последняя связь: {formatDate(device.lastSeenAt)}
          </p>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <div className="grid min-w-0 gap-5">
          <Card>
            <CardHeader>
              <h2 className="font-bold">Устройство и автомобиль</h2>
            </CardHeader>
            <CardContent>
              <dl>
                <DetailRow label="Серийный номер">
                  <span className="font-mono">{device.serialNumber}</span>
                </DetailRow>
                <DetailRow label="IMEI">
                  <span className="font-mono">{device.imei}</span>
                </DetailRow>
                <DetailRow label="Аппаратная версия">{device.hardwareVersion}</DetailRow>
                <DetailRow label="Автомобиль">
                  {device.vehicle ? (
                    <Link
                      href={`/vehicles/${device.vehicle.id}`}
                      className="text-[var(--color-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                    >
                      {device.vehicle.label}
                    </Link>
                  ) : (
                    'Не привязано'
                  )}
                </DetailRow>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="font-bold">Связь и навигация</h2>
            </CardHeader>
            <CardContent>
              <dl>
                <DetailRow label="Сотовая связь">
                  <span className="inline-flex items-center gap-2">
                    <FiRadio aria-hidden="true" />
                    {connection}
                  </span>
                </DetailRow>
                <DetailRow label="ГЛОНАСС">
                  <span className="inline-flex items-center gap-2">
                    <FiNavigation aria-hidden="true" />
                    {glonass}
                  </span>
                </DetailRow>
                <DetailRow label="Последняя связь">{formatDate(device.lastSeenAt)}</DetailRow>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="font-bold">Последние координаты</h2>
            </CardHeader>
            <CardContent className="grid gap-4 p-0">
              {device.latitude === null || device.longitude === null ? (
                <div className="grid min-h-56 place-items-center p-5 text-center text-sm text-[var(--color-text-secondary)]">
                  Координаты ещё не получены
                </div>
              ) : (
                <DeviceMiniMap latitude={device.latitude} longitude={device.longitude} />
              )}
              <div className="px-5 pb-5 text-sm text-[var(--color-text-secondary)]">
                <FiMapPin aria-hidden="true" className="mr-1 inline" />
                {device.latitude === null || device.longitude === null
                  ? 'Нет данных'
                  : `${device.latitude.toFixed(6)}, ${device.longitude.toFixed(6)}`}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid min-w-0 gap-5">
          <Card>
            <CardHeader>
              <h2 className="font-bold">Питание и состояние</h2>
            </CardHeader>
            <CardContent>
              <dl>
                <DetailRow label="Питание">
                  <span className="inline-flex items-center gap-2">
                    <FiZap aria-hidden="true" />
                    {power}
                  </span>
                </DetailRow>
                <DetailRow label="Зажигание">
                  <span className="inline-flex items-center gap-2">
                    <FiActivity aria-hidden="true" />
                    {device.ignitionOn ? 'Включено' : 'Выключено'}
                  </span>
                </DetailRow>
                <DetailRow label="Движение">
                  <span className="inline-flex items-center gap-2">
                    <FiBatteryCharging aria-hidden="true" />
                    {device.isMoving ? 'Да' : 'Нет'}
                  </span>
                </DetailRow>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="font-bold">Прошивка</h2>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p>
                <span className="text-sm text-[var(--color-text-secondary)]">Текущая версия</span>
                <strong className="ml-2">{device.firmwareVersion}</strong>
              </p>
              {device.availableFirmwareReleases.map((release) => (
                <div
                  key={release.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] p-3"
                >
                  <span className="font-medium">Доступно обновление: {release.version}</span>
                  {release.isRequired ? <Badge tone="danger">Обязательно</Badge> : null}
                </div>
              ))}
              {!device.availableFirmwareReleases.length ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Установлена актуальная версия прошивки.
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="font-bold">Действия</h2>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <DeviceCommandDialog
                deviceId={device.id}
                deviceName={device.name}
                serialNumber={device.serialNumber}
                type="REBOOT"
                disabled={device.hasActiveCommand}
                onSuccess={() => router.refresh()}
              />
              <DeviceCommandDialog
                deviceId={device.id}
                deviceName={device.name}
                serialNumber={device.serialNumber}
                type="SHUTDOWN"
                disabled={device.hasActiveCommand}
                onSuccess={() => router.refresh()}
              />
              <DeviceCommandDialog
                deviceId={device.id}
                deviceName={device.name}
                serialNumber={device.serialNumber}
                type="UPDATE_FIRMWARE"
                firmwareReleases={device.availableFirmwareReleases}
                disabled={device.hasActiveCommand}
                onSuccess={() => router.refresh()}
              />
              <DeviceBindingDialog
                deviceId={device.id}
                vehicle={device.vehicle}
                availableVehicles={availableVehicles}
                onSuccess={() => router.refresh()}
              />
            </CardContent>
          </Card>
          <DeviceCommandHistory commands={device.commands} onSuccess={() => router.refresh()} />
        </div>
      </div>
    </main>
  );
}
