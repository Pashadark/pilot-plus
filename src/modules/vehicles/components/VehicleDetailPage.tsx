'use client';

import Link from 'next/link';
import {
  FiArrowLeft,
  FiMapPin,
  FiTruck,
  FiCheck,
  FiAlertTriangle,
  FiAlertCircle,
  FiDroplet,
  FiFile,
  FiNavigation,
} from 'react-icons/fi';

import type {
  VehicleDetailDto,
  VehicleMaintenanceKind,
  VehicleMaintenanceStatus,
  VehicleStatus,
  VehicleWashKind,
  VehicleWashStatus,
} from '../types';
import { formatDailyPrice, formatOptionalMetric } from '../utils';
import { VehicleEmptySection } from './VehicleEmptySection';
import { VehicleOverview } from './VehicleOverview';
import { VehiclePhoto } from './VehiclePhoto';
import { VehicleTabs } from './VehicleTabs';
import type { VehicleTab } from './vehicle-tabs';
import { PILOT_BUSINESS_TIME_ZONE } from '@/shared/business-time';
import { Badge, Card, CardContent, CardHeader } from '@/shared/ui';

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
    if (!vehicle.maintenanceRecords.length && !vehicle.washRecords.length) {
      return <VehicleEmptySection tab={tab} />;
    }
    return (
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
                          {maintenanceKinds[record.kind]}
                        </p>
                        <strong>{record.title}</strong>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </header>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      План: {formatDate(record.scheduledAt)} · Пробег:{' '}
                      {formatOptionalMetric(record.targetOdometerKm, 'км')} · Стоимость:{' '}
                      {formatCost(record.costMinor)}
                      {record.provider ? ` · ${record.provider}` : ''}
                    </p>
                  </article>
                );
              })
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">Записей о ТО пока нет.</p>
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
                      {formatDate(record.completedAt)} · Стоимость: {formatCost(record.costMinor)}
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
    const documents = vehicle.documents;
    if (!documents.length) return <VehicleEmptySection tab={tab} />;
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Документы</h2>
            <Badge tone="primary">{documents.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {documents.map((document) => (
            <div
              key={document.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <FiFile className="size-4 text-[var(--color-primary)]" />
                <div>
                  <p className="text-sm font-medium">{document.title}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {document.type} · Действует до: {formatDate(document.expiresAt)}
                  </p>
                </div>
              </div>
              <Badge size="sm" tone="success">
                Действует
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    );
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

  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="vehicle-detail-page">
      <Link
        href="/vehicles"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      >
        <FiArrowLeft aria-hidden="true" />К автопарку
      </Link>

      <Card className="overflow-hidden">
        <header className="grid items-stretch md:grid-cols-[minmax(260px,38%)_1fr]">
          <VehiclePhoto
            image={vehicle.primaryImage}
            model={vehicle.model}
            city={vehicle.city}
            sizes="(max-width: 768px) 100vw, 38vw"
            testId="vehicle-detail-photo"
            className="md:aspect-auto md:min-h-56"
          />
          <div className="flex flex-wrap items-start justify-between gap-4 p-5">
            <div className="flex min-w-0 gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <FiTruck aria-hidden="true" className="size-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{vehicle.model}</h1>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {vehicle.internalNumber}
                  {vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ''}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
                  <FiMapPin aria-hidden="true" />
                  {[vehicle.city, vehicle.office].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="block text-xs text-[var(--color-text-tertiary)]">
                Стоимость аренды
              </span>
              <strong className="text-lg">
                {formatDailyPrice(vehicle.dailyPriceMinor, vehicle.currency)}
              </strong>
              <Link
                href={`/vehicles/${vehicle.id}/edit`}
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
              >
                Редактировать
              </Link>
            </div>
          </div>
        </header>

        <VehicleTabs vehicleId={vehicle.id} activeTab={activeTab} />
      </Card>

      <TabContent vehicle={vehicle} tab={activeTab} />
    </main>
  );
}
