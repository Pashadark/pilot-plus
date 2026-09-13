'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import {
  FiArrowLeft,
  FiMapPin,
  FiCheck,
  FiAlertTriangle,
  FiAlertCircle,
  FiDroplet,
  FiNavigation,
  FiEdit3,
  FiTruck,
  FiUser,
  FiHash,
  FiActivity,
  FiTool,
  FiMap,
  FiCalendar,
  FiTrash2,
  FiDollarSign,
} from 'react-icons/fi';

import type {
  VehicleDetailDto,
  VehicleMaintenanceKind,
  VehicleMaintenanceStatus,
  VehicleStatus,
  VehicleWashKind,
  VehicleWashStatus,
} from '../types';
import { formatOptionalMetric } from '../utils';
import { VehicleEmptySection } from './VehicleEmptySection';
import { VehicleOverview } from './VehicleOverview';
import { VehiclePhoto } from './VehiclePhoto';
import { VehiclePopularityMedal } from './VehiclePopularityMedal';
import { VehicleTabs } from './VehicleTabs';
import type { VehicleTab } from './vehicle-tabs';
import { PILOT_BUSINESS_TIME_ZONE } from '@/shared/business-time';
import { Badge, Card, CardContent, CardHeader } from '@/shared/ui';
import { VehicleDocumentsPanel } from '@/modules/vehicles/manage/components/VehicleDocumentsPanel';

const MAINTENANCE_INTERVAL_KM = 7_000;

// ============================================================================
// СТАТУСЫ
// ============================================================================

const statuses: Record<
  VehicleStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }
> = {
  MOVING: { label: 'В движении', tone: 'success' },
  IDLE: { label: 'Стоит', tone: 'warning' },
  OFFLINE: { label: 'Не на связи', tone: 'danger' },
  MAINTENANCE: { label: 'Обслуживание', tone: 'info' },
  UNKNOWN: { label: 'Нет телеметрии', tone: 'neutral' },
};

const maintenanceStatuses: Record<
  VehicleMaintenanceStatus,
  { label: string; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }
> = {
  PLANNED: { label: 'Запланировано', tone: 'primary' },
  IN_PROGRESS: { label: 'В работе', tone: 'warning' },
  COMPLETED: { label: 'Завершено', tone: 'success' },
  OVERDUE: { label: 'Просрочено', tone: 'danger' },
  CANCELLED: { label: 'Отменено', tone: 'neutral' },
  DAMAGE_REPORTED: { label: 'Повреждение', tone: 'danger' },
  WAITING_REPAIR: { label: 'Ожидает ремонта', tone: 'warning' },
};

const maintenanceKinds: Record<VehicleMaintenanceKind, string> = {
  OIL: 'Масло',
  FILTERS: 'Фильтры',
  BRAKES: 'Тормоза',
  TIRES: 'Шины',
  TIMING: 'ГРМ',
  INSPECTION: 'Диагностика',
  OTHER: 'Другое',
};

const washStatuses: Record<
  VehicleWashStatus,
  { label: string; tone: 'neutral' | 'primary' | 'success' | 'warning' }
> = {
  PLANNED: { label: 'Запланировано', tone: 'primary' },
  IN_PROGRESS: { label: 'В работе', tone: 'warning' },
  COMPLETED: { label: 'Завершено', tone: 'success' },
  CANCELLED: { label: 'Отменено', tone: 'neutral' },
};

const washKinds: Record<VehicleWashKind, string> = {
  BODY: 'Кузов',
  COMPLEX: 'Комплексная',
  INTERIOR: 'Салон',
  MATS: 'Коврики',
  ENGINE: 'Двигатель',
  OTHER: 'Другое',
};

// ============================================================================
// ФУНКЦИИ ФОРМАТИРОВАНИЯ
// ============================================================================

function formatDate(value: string | null) {
  if (!value) return 'Нет данных';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: PILOT_BUSINESS_TIME_ZONE,
  }).format(new Date(value));
}

function formatCost(value: number | null) {
  if (value === null) return 'Не указана';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(value / 100);
}

// ============================================================================
// TAB CONTENT
// ============================================================================

function TabContent({ vehicle, tab }: { vehicle: VehicleDetailDto; tab: VehicleTab }) {
  // Обзор
  if (tab === 'overview') {
    return <VehicleOverview vehicle={vehicle} />;
  }

  if (tab === 'history') {
    const history = [
      ...(vehicle.rentals ?? []).map((rental) => ({
        id: `rental-${rental.id}`,
        date: rental.startsAt,
        title: rental.status === 'COMPLETED' ? 'Аренда завершена' : 'Аренда автомобиля',
        description: `${rental.contractNumber ?? 'Договор'} · ${rental.client.fullName}`,
      })),
      ...vehicle.maintenanceRecords.map((record) => ({
        id: `maintenance-${record.id}`,
        date:
          record.completedAt ?? record.damageReportedAt ?? record.scheduledAt ?? vehicle.createdAt,
        title: record.title,
        description: `${record.recordType === 'REPAIR' ? 'Ремонт' : 'Техническое обслуживание'} · ${maintenanceStatuses[record.status].label}`,
      })),
      ...vehicle.washRecords.map((record) => ({
        id: `wash-${record.id}`,
        date: record.completedAt ?? record.scheduledAt,
        title: washKinds[record.kind],
        description: `Мойка · ${washStatuses[record.status].label}`,
      })),
      ...vehicle.events.map((event) => ({
        id: `event-${event.id}`,
        date: event.recordedAt,
        title: event.title,
        description: event.description ?? 'Событие автомобиля',
      })),
    ].sort((left, right) => right.date.localeCompare(left.date));
    if (!history.length) return <VehicleEmptySection tab={tab} />;
    return (
      <Card>
        <CardHeader>
          <h2 className="font-bold">История автомобиля</h2>
        </CardHeader>
        <CardContent className="divide-y divide-[var(--color-border)]">
          {history.map((item) => (
            <article
              key={item.id}
              className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[170px_1fr]"
            >
              <time className="text-sm text-[var(--color-text-secondary)]">
                {formatDate(item.date)}
              </time>
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                  {item.description}
                </p>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Поездки
  if (tab === 'trips') {
    const trips = vehicle.trips;
    if (!trips.length) return <VehicleEmptySection tab={tab} />;
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Поездки</h2>
            <Badge tone="primary">{trips.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {trips.map((trip) => (
            <div
              key={trip.id}
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-[var(--color-surface-soft)]"
            >
              <div className="flex items-center gap-3">
                <FiNavigation className="size-4 text-[var(--color-primary)]" />
                <div>
                  <p className="text-sm font-medium">{formatDate(trip.startedAt)}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Расстояние: {formatOptionalMetric(trip.distanceKm, 'км')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {trip.endedAt ? `Завершена: ${formatDate(trip.endedAt).split(',')[0]}` : 'В пути'}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Маршруты
  if (tab === 'routes') {
    return <VehicleEmptySection tab={tab} />;
  }

  // События
  if (tab === 'events') {
    const events = vehicle.events;
    if (!events.length) return <VehicleEmptySection tab={tab} />;
    const tones = ['info', 'danger', 'warning', 'success'];
    const colors = {
      info: 'bg-[var(--color-primary)]',
      success: 'bg-[var(--color-success)]',
      warning: 'bg-[var(--color-warning)]',
      danger: 'bg-[var(--color-danger)]',
    };
    const icons = {
      info: <FiMapPin className="size-3" />,
      success: <FiCheck className="size-3" />,
      warning: <FiAlertTriangle className="size-3" />,
      danger: <FiAlertCircle className="size-3" />,
    };
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-bold">События</h2>
            <Badge tone="primary">{events.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {events.map((event, index) => {
            const tone = tones[index % tones.length] as 'info' | 'danger' | 'warning' | 'success';
            return (
              <div
                key={event.id}
                className="flex items-center gap-2 rounded-lg border px-2.5 py-2 hover:bg-[var(--color-surface-soft)]"
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-white ${colors[tone]}`}
                >
                  {icons[tone]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{event.title}</p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">
                    {vehicle.model} ·{' '}
                    {formatDate(event.recordedAt).split(',')[1]?.trim() || '10:42'}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  // Топливо
  if (tab === 'fuel') {
    const fuelRecords = vehicle.fuelRecords;
    if (!fuelRecords.length) return <VehicleEmptySection tab={tab} />;
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Заправки</h2>
            <Badge tone="primary">{fuelRecords.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {fuelRecords.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <FiDroplet className="size-4 text-[var(--color-primary)]" />
                <div>
                  <p className="text-sm font-medium">{record.volumeLiters} л</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Запись о заправке</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {formatDate(record.recordedAt).split(',')[0]}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Обслуживание
  if (tab === 'maintenance') {
    return (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Ремонты и техническое обслуживание</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Полная история работ, повреждений, фото и документов.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border px-4 text-sm font-semibold hover:bg-[var(--color-elevated)]"
              href={`/maintenance?view=list&create=maintenance&vehicleId=${vehicle.id}`}
            >
              Запланировать ТО
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-primary-hover)]"
              href={`/maintenance?view=list&create=repair&vehicleId=${vehicle.id}`}
            >
              Добавить ремонт
            </Link>
          </div>
        </div>
        {!vehicle.maintenanceRecords.length && !vehicle.washRecords.length ? (
          <VehicleEmptySection tab={tab} />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card data-testid="vehicle-maintenance-history">
              <CardHeader>
                <h2 className="font-bold">История технического обслуживания</h2>
              </CardHeader>
              <CardContent className="grid gap-3">
                {vehicle.maintenanceRecords.length ? (
                  vehicle.maintenanceRecords.map((record) => {
                    const status = maintenanceStatuses[record.status];
                    return (
                      <article
                        key={record.id}
                        className="grid gap-2 border-b border-[var(--color-border)] pb-3 last:border-0"
                      >
                        <header className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-[var(--color-text-tertiary)]">
                              {record.recordType === 'REPAIR'
                                ? 'Ремонт и повреждение'
                                : maintenanceKinds[record.kind]}
                            </p>
                            <strong>{record.title}</strong>
                          </div>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </header>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {record.recordType === 'REPAIR' ? 'Повреждение' : 'План'}:{' '}
                          {formatDate(
                            record.recordType === 'REPAIR'
                              ? (record.damageReportedAt ?? null)
                              : record.scheduledAt,
                          )}{' '}
                          · Пробег: {formatOptionalMetric(record.targetOdometerKm, 'км')} ·
                          Стоимость: {formatCost(record.costMinor)}
                          {record.provider ? ` · ${record.provider}` : ''}
                        </p>
                        {record.description ? (
                          <p className="text-sm">{record.description}</p>
                        ) : null}
                        {record.recordType === 'REPAIR' && (record.client || record.rental) ? (
                          <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                            {record.client ? (
                              <Link
                                className="font-semibold text-[var(--color-primary)] hover:underline"
                                href={`/clients/${record.client.id}`}
                              >
                                {record.client.fullName}
                              </Link>
                            ) : null}
                            {record.rental ? (
                              <Link
                                className="font-semibold text-[var(--color-primary)] hover:underline"
                                href={`/rentals/${record.rental.id}`}
                              >
                                {record.rental.contractNumber ?? 'Договор без номера'}
                              </Link>
                            ) : null}
                          </p>
                        ) : null}
                        {record.workItems?.length ? (
                          <ul className="grid gap-1 text-sm text-[var(--color-text-secondary)]">
                            {record.workItems.map((item) => (
                              <li key={item.id}>
                                • {item.title}
                                {item.description ? ` — ${item.description}` : ''}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {record.attachments?.length ? (
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {record.attachments.map((attachment) =>
                              attachment.isImage ? (
                                <Link
                                  key={attachment.id}
                                  href={attachment.url}
                                  target="_blank"
                                  className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-md)] border"
                                >
                                  <Image
                                    src={attachment.url}
                                    alt={`${record.title} — фото`}
                                    fill
                                    unoptimized
                                    sizes="180px"
                                    className="object-cover"
                                  />
                                </Link>
                              ) : (
                                <Link
                                  key={attachment.id}
                                  href={attachment.url}
                                  target="_blank"
                                  className="rounded-[var(--radius-md)] border p-2 text-sm font-semibold text-[var(--color-primary)]"
                                >
                                  {attachment.originalName}
                                </Link>
                              ),
                            )}
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Записей о ТО пока нет.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card data-testid="vehicle-wash-history">
              <CardHeader>
                <h2 className="font-bold">История моек</h2>
              </CardHeader>
              <CardContent className="grid gap-3">
                {vehicle.washRecords.length ? (
                  vehicle.washRecords.map((record) => {
                    const status = washStatuses[record.status];
                    return (
                      <article
                        key={record.id}
                        className="grid gap-2 border-b border-[var(--color-border)] pb-3 last:border-0"
                      >
                        <header className="flex flex-wrap items-start justify-between gap-2">
                          <strong>{washKinds[record.kind]}</strong>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </header>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          План: {formatDate(record.scheduledAt)} · Завершение:{' '}
                          {formatDate(record.completedAt)} · Стоимость:{' '}
                          {formatCost(record.costMinor)}
                          {record.provider ? ` · ${record.provider}` : ''}
                        </p>
                      </article>
                    );
                  })
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Записей о мойке пока нет.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  if (tab === 'rentals') {
    const rentals = vehicle.rentals ?? [];
    if (!rentals.length) return <VehicleEmptySection tab={tab} />;
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-bold">История аренд и клиентов</h2>
            <Badge tone="primary">{rentals.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rentals.map((rental) => (
            <article
              key={rental.id}
              className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <Link
                  href={`/rentals/${rental.id}`}
                  className="font-semibold text-[var(--color-primary)] hover:underline"
                >
                  {rental.contractNumber ?? 'Черновик договора'}
                </Link>
                <p className="mt-1 text-sm">
                  <Link href={`/clients/${rental.client.id}`} className="hover:underline">
                    {rental.client.fullName}
                  </Link>
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {formatDate(rental.startsAt)} — {formatDate(rental.endsAt)}
                </p>
                {rental.operations.map((operation) => (
                  <p key={operation.id} className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {operation.type === 'HANDOVER'
                      ? 'Выдача'
                      : operation.type === 'RETURN'
                        ? 'Возврат'
                        : 'Продление'}{' '}
                    · {formatDate(operation.occurredAt)}
                    {operation.mileageKm === null ? '' : ` · ${operation.mileageKm} км`}
                    {operation.fuelLevelPercent === null
                      ? ''
                      : ` · топливо ${operation.fuelLevelPercent}%`}
                    {operation.evidenceStatus === 'COMPLETE' ? '' : ' · фиксация неполная'}
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {rental.documents.map((document) => (
                  <Link
                    key={document.id}
                    href={`/rentals/${rental.id}/documents/${document.version}/${document.format}`}
                    className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border px-3 text-sm font-semibold hover:bg-[var(--color-elevated)]"
                  >
                    {document.format}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Документы
  if (tab === 'documents') {
    return <VehicleDocumentsPanel vehicleId={vehicle.id} documents={vehicle.documents} />;
  }

  return <VehicleEmptySection tab={tab} />;
}

// ============================================================================
// ГЛАВНЫЙ КОМПОНЕНТ
// ============================================================================

export function VehicleDetailPage({
  vehicle,
  activeTab,
}: {
  vehicle: VehicleDetailDto;
  activeTab: VehicleTab;
}) {
  const status = statuses[vehicle.status] || statuses.UNKNOWN;
  const isInPark =
    vehicle.telemetry.address?.toLocaleLowerCase('ru-RU').includes('зел') &&
    vehicle.telemetry.address.includes('22');
  const visibleStatus = isInPark ? { label: 'В парке', tone: 'success' as const } : status;
  const activeRental =
    vehicle.currentRentalId === undefined
      ? vehicle.rentals?.find((rental) => rental.status === 'ACTIVE')
      : vehicle.rentals?.find((rental) => rental.id === vehicle.currentRentalId);
  const nextMaintenance = vehicle.maintenanceRecords.find((record) =>
    ['PLANNED', 'IN_PROGRESS', 'OVERDUE'].includes(record.status),
  );
  const maintenanceTargetKm =
    nextMaintenance?.targetOdometerKm ??
    (vehicle.telemetry.odometerKm === null
      ? null
      : vehicle.telemetry.odometerKm + MAINTENANCE_INTERVAL_KM);
  const remainingKm =
    maintenanceTargetKm !== null && vehicle.telemetry.odometerKm !== null
      ? Math.round(maintenanceTargetKm - vehicle.telemetry.odometerKm)
      : null;
  const latestWash = vehicle.washRecords[0];
  const condition =
    latestWash?.status === 'COMPLETED'
      ? 'Чистая'
      : latestWash?.status === 'IN_PROGRESS'
        ? 'На мойке'
        : 'Нет данных';
  const drivers = activeRental
    ? activeRental.drivers?.length
      ? activeRental.drivers
      : [{ id: activeRental.client.id, fullName: activeRental.client.fullName }]
    : [];
  const galleryImages = vehicle.galleryImages?.length
    ? vehicle.galleryImages
    : vehicle.primaryImage
      ? [vehicle.primaryImage]
      : [];
  const gallerySlots = galleryImages.length
    ? Array.from({ length: 3 }, (_, index) => galleryImages[index] ?? null)
    : [];
  const [selectedImagePath, setSelectedImagePath] = useState<string | null>(null);
  const selectedImage =
    galleryImages.find((image) => image.localPath === selectedImagePath) ??
    galleryImages[0] ??
    vehicle.primaryImage;

  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="vehicle-detail-page">
      <Link
        href="/vehicles"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      >
        <FiArrowLeft aria-hidden="true" />К списку автомобилей
      </Link>

      <section className="grid gap-4" data-testid="vehicle-hero">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <FiTruck aria-hidden="true" className="size-6" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{vehicle.model}</h1>
                <Badge tone={visibleStatus.tone}>{visibleStatus.label}</Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {vehicle.internalNumber}
                {vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ''}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
                <FiMapPin aria-hidden="true" />
                {(vehicle.telemetry.address ??
                  [vehicle.city, vehicle.office].filter(Boolean).join(' · ')) ||
                  'Адрес не указан'}
              </p>
            </div>
          </div>
          <div className="text-sm">
            <p className="text-[var(--color-text-secondary)]">Последний сигнал</p>
            <p className="mt-1 flex items-center gap-2 font-medium">
              <span
                className={`size-2.5 rounded-full ${vehicle.gpsStatus.isConnected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`}
              />
              {formatDate(vehicle.telemetry.lastSeenAt)}
            </p>
          </div>
        </header>

        <div
          className="grid gap-4 xl:grid-cols-[minmax(380px,1.08fr)_minmax(340px,0.96fr)_minmax(230px,0.68fr)]"
          data-testid="vehicle-hero-grid"
        >
          <div className="min-w-0">
            <div className="relative">
              <VehiclePhoto
                image={selectedImage}
                model={vehicle.model}
                city={vehicle.city}
                sizes="(max-width: 1280px) 100vw, 38vw"
                testId="vehicle-detail-photo"
                className="rounded-[var(--radius-panel)] border shadow-[var(--shadow-card)] xl:aspect-[1.38/1]"
              />
              {vehicle.popularityRank ? (
                <span
                  className="pointer-events-none absolute top-3 right-3 z-10"
                  data-testid="vehicle-detail-popularity-medal"
                >
                  <VehiclePopularityMedal rank={vehicle.popularityRank} />
                </span>
              ) : null}
            </div>
            {gallerySlots.length ? (
              <div className="mt-3 grid grid-cols-3 gap-3" aria-label="Фотографии автомобиля">
                {gallerySlots.map((image, index) => {
                  const isSelected = image?.localPath === selectedImage?.localPath;

                  return (
                    <div
                      key={image ? `${image.localPath}-${index}` : `empty-${index}`}
                      data-testid="vehicle-gallery-slot"
                    >
                      {image ? (
                        <button
                          type="button"
                          aria-label={`Открыть фото ${index + 1}: ${image.alt}`}
                          aria-pressed={isSelected}
                          onClick={() => setSelectedImagePath(image.localPath)}
                          className="block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                        >
                          <VehiclePhoto
                            image={image}
                            model={vehicle.model}
                            city={vehicle.city}
                            sizes="140px"
                            testId="vehicle-gallery-thumbnail"
                            className={`rounded-lg border ${isSelected ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]' : ''}`}
                          />
                        </button>
                      ) : (
                        <VehiclePhoto
                          image={null}
                          model={vehicle.model}
                          city={vehicle.city}
                          sizes="140px"
                          testId="vehicle-gallery-thumbnail"
                          className="rounded-lg border"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <section
            className="min-w-0 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            data-testid="vehicle-technical-state"
          >
            <h2 className="text-base font-bold">Техническое состояние</h2>
            <div className="mt-2 divide-y divide-[var(--color-border)]">
              <DriverMetric drivers={drivers} />
              <HeroMetric
                icon={<FiHash />}
                label="Пробег"
                value={formatOptionalMetric(vehicle.telemetry.odometerKm, 'км')}
              />
              <HeroFuel value={vehicle.telemetry.fuelLevelPercent} />
              <HeroMetric
                icon={<FiActivity />}
                label="Скорость"
                value={formatOptionalMetric(vehicle.telemetry.speedKph ?? null, 'км/ч')}
              />
              <HeroMetric icon={<FiActivity />} label="Чистота" value={condition} />
              <MaintenanceMetric remainingKm={remainingKm} targetKm={maintenanceTargetKm} />
              <HeroMetric icon={<FiCheck />} label="ОСАГО" value={getOsagoLabel(vehicle)} />
            </div>
          </section>

          <aside
            className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            aria-label="Действия с автомобилем"
          >
            <h2 className="text-base font-bold">Действия</h2>
            <div className="mt-3 grid gap-2">
              <ActionLink
                href={`/rentals/new?vehicleId=${vehicle.id}`}
                icon={<FiCalendar />}
                primary
              >
                Выдать в аренду
              </ActionLink>
              <ActionLink
                href={`/rentals/new?vehicleId=${vehicle.id}&mode=booking`}
                icon={<FiCalendar />}
              >
                Забронировать
              </ActionLink>
              <ActionLink href={`/map?vehicleId=${vehicle.id}`} icon={<FiMap />}>
                На карте
              </ActionLink>
              <ActionLink href={`/vehicles/${vehicle.id}/edit`} icon={<FiEdit3 />}>
                Редактировать
              </ActionLink>
              <ActionLink href={`/wash?vehicleId=${vehicle.id}`} icon={<FiDroplet />}>
                На мойку
              </ActionLink>
              <ActionLink href={`/maintenance?vehicleId=${vehicle.id}`} icon={<FiTool />}>
                Запланировать ТО
              </ActionLink>
              <ActionLink href={`/vehicles/${vehicle.id}?tab=fuel`} icon={<FiDollarSign />}>
                Добавить расход
              </ActionLink>
              <ActionLink href={`/vehicles/${vehicle.id}/edit#archive`} icon={<FiTrash2 />} danger>
                Удалить автомобиль
              </ActionLink>
            </div>
          </aside>
        </div>
      </section>

      <VehicleTabs vehicleId={vehicle.id} activeTab={activeTab} />

      <TabContent vehicle={vehicle} tab={activeTab} />
    </main>
  );
}

function HeroMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 py-3">
      <span className="mt-0.5 size-5 shrink-0 text-[var(--color-text-secondary)]">{icon}</span>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
        <p className="truncate text-right text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function HeroFuel({ value }: { value: number | null }) {
  const safeValue = Math.max(0, Math.min(100, value ?? 0));

  return (
    <div className="flex min-w-0 items-center gap-3 py-3">
      <FiDroplet className="mt-0.5 size-5 shrink-0 text-[var(--color-text-secondary)]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-text-secondary)]">Топливо</p>
          <p className="text-sm font-medium">{value === null ? 'Нет данных' : `${value}%`}</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
          <div
            className="h-full rounded-full bg-[var(--color-success)]"
            style={{ width: `${safeValue}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function DriverMetric({ drivers }: { drivers: { id: string; fullName: string }[] }) {
  return (
    <div className="flex min-w-0 gap-3 py-3">
      <FiUser className="mt-0.5 size-5 shrink-0 text-[var(--color-text-secondary)]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-text-secondary)]">Водитель</p>
          {drivers.length > 1 ? (
            <span className="text-xs text-[var(--color-text-secondary)]">
              {drivers.length} водителя
            </span>
          ) : null}
        </div>
        {drivers.length ? (
          <ul className="mt-1 grid gap-1 text-right text-sm font-medium">
            {drivers.map((driver) => (
              <li key={driver.id}>{driver.fullName}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-right text-sm font-medium">Нет активного водителя</p>
        )}
      </div>
    </div>
  );
}

function MaintenanceMetric({
  remainingKm,
  targetKm,
}: {
  remainingKm: number | null;
  targetKm: number | null;
}) {
  const progress =
    remainingKm === null || targetKm === null || targetKm <= 0
      ? 0
      : Math.max(
          0,
          Math.min(100, ((MAINTENANCE_INTERVAL_KM - remainingKm) / MAINTENANCE_INTERVAL_KM) * 100),
        );
  const label =
    remainingKm === null
      ? 'Нет данных'
      : remainingKm <= 0
        ? 'Просрочено'
        : `${remainingKm.toLocaleString('ru-RU')} км`;
  return (
    <div className="flex min-w-0 items-center gap-3 py-3">
      <FiTool className="size-5 shrink-0 text-[var(--color-text-secondary)]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-text-secondary)]">Следующее ТО</p>
          <p
            className={`text-sm font-medium ${remainingKm !== null && remainingKm <= 0 ? 'text-[var(--color-danger)]' : ''}`}
          >
            {label}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
          <div
            className="h-full rounded-full bg-[var(--color-primary)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function getOsagoLabel(vehicle: VehicleDetailDto) {
  const osago = vehicle.documents.find((document) =>
    document.type.toLocaleUpperCase('ru-RU').includes('ОСАГО'),
  );
  return osago?.expiresAt ? `до ${formatDate(osago.expiresAt).split(',')[0]}` : 'Нет данных';
}

function ActionLink({
  href,
  icon,
  children,
  primary = false,
  danger = false,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  primary?: boolean;
  danger?: boolean;
}) {
  const tone = primary
    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white hover:opacity-90'
    : danger
      ? 'border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]'
      : 'border-[var(--color-border)] hover:bg-[var(--color-elevated)]';
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${tone}`}
    >
      {icon}
      {children}
    </Link>
  );
}
