import Link from 'next/link';
import { FiArrowLeft, FiMapPin, FiTruck } from 'react-icons/fi';

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
import { Badge, Card, CardContent, CardHeader } from '@/shared/ui';

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

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'Нет данных';
}

function formatCost(value: number | null) {
  if (value === null) return 'Не указана';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function TabContent({ vehicle, tab }: { vehicle: VehicleDetailDto; tab: VehicleTab }) {
  if (tab === 'overview') return <VehicleOverview vehicle={vehicle} />;
  if (tab === 'trips' && vehicle.trips.length)
    return (
      <Card>
        <CardContent className="grid gap-3">
          {vehicle.trips.map((trip) => (
            <article
              key={trip.id}
              className="grid gap-1 border-b border-[var(--color-border)] pb-3 last:border-0"
            >
              <strong>{formatDate(trip.startedAt)}</strong>
              <span className="text-sm text-[var(--color-text-secondary)]">
                Окончание: {formatDate(trip.endedAt)} · Расстояние:{' '}
                {formatOptionalMetric(trip.distanceKm, 'км')}
              </span>
            </article>
          ))}
        </CardContent>
      </Card>
    );
  if (tab === 'events' && vehicle.events.length)
    return (
      <Card>
        <CardContent className="grid gap-3">
          {vehicle.events.map((event) => (
            <article
              key={event.id}
              className="border-b border-[var(--color-border)] pb-3 last:border-0"
            >
              <strong>{event.title}</strong>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {formatDate(event.recordedAt)}
                {event.description ? ` · ${event.description}` : ''}
              </p>
            </article>
          ))}
        </CardContent>
      </Card>
    );
  if (tab === 'fuel' && vehicle.fuelRecords.length)
    return (
      <Card>
        <CardContent className="grid gap-3">
          {vehicle.fuelRecords.map((record) => (
            <p
              key={record.id}
              className="flex justify-between gap-4 border-b border-[var(--color-border)] pb-3 last:border-0"
            >
              <span>{formatDate(record.recordedAt)}</span>
              <strong>{formatOptionalMetric(record.volumeLiters, 'л')}</strong>
            </p>
          ))}
        </CardContent>
      </Card>
    );
  if (tab === 'maintenance' && (vehicle.maintenanceRecords.length || vehicle.washRecords.length))
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
  if (tab === 'documents' && vehicle.documents.length)
    return (
      <Card>
        <CardContent className="grid gap-3">
          {vehicle.documents.map((document) => (
            <article
              key={document.id}
              className="border-b border-[var(--color-border)] pb-3 last:border-0"
            >
              <strong>{document.title}</strong>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Тип: {document.type} · Действует до: {formatDate(document.expiresAt)}
              </p>
            </article>
          ))}
        </CardContent>
      </Card>
    );
  return <VehicleEmptySection tab={tab} />;
}

export function VehicleDetailPage({
  vehicle,
  activeTab,
}: {
  vehicle: VehicleDetailDto;
  activeTab: VehicleTab;
}) {
  const status = statuses[vehicle.status];
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
            </div>
          </div>
        </header>
        <VehicleTabs vehicleId={vehicle.id} activeTab={activeTab} />
      </Card>
      <TabContent vehicle={vehicle} tab={activeTab} />
    </main>
  );
}
