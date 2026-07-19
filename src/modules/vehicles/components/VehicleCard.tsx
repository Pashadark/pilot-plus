'use client';

import Link from 'next/link';
import {
  FiCalendar,
  FiClock,
  FiDroplet,
  FiActivity,
  FiMap,
  FiMapPin,
  FiNavigation,
  FiTruck,
  FiUsers,
} from 'react-icons/fi';

import type { VehicleCardDto, VehicleStatus } from '../types';
import { formatDailyPrice, formatOptionalMetric } from '../utils';
import { VehiclePhoto } from './VehiclePhoto';
import { useToast } from '@/shared/providers/ToastProvider';
import { Badge, Button, Card } from '@/shared/ui';

const statusView: Record<
  VehicleStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }
> = {
  MOVING: { label: 'В движении', tone: 'success' },
  IDLE: { label: 'Стоит', tone: 'warning' },
  OFFLINE: { label: 'Не на связи', tone: 'danger' },
  MAINTENANCE: { label: 'Обслуживание', tone: 'info' },
  UNKNOWN: { label: 'Нет телеметрии', tone: 'neutral' },
};

const fuelLabels = {
  PETROL: 'Бензин',
  DIESEL: 'Дизель',
  ELECTRIC: 'Электричество',
  HYBRID: 'Гибрид',
  OTHER: 'Другое',
} as const;

function dateOrEmpty(value: string | null) {
  if (!value) return 'Нет данных';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function VehicleCard({ vehicle }: { vehicle: VehicleCardDto }) {
  const { showToast } = useToast();
  const status = statusView[vehicle.status];

  const explainMissingPosition = () => {
    if (vehicle.telemetry.hasPosition) return;
    showToast({
      tone: 'info',
      title: 'Координаты пока не получены',
      description: `${vehicle.model} появится на карте после первого сигнала GPS-трекера.`,
    });
  };

  return (
    <Card className="group min-w-0 overflow-hidden transition-[border-color,box-shadow,transform] duration-[var(--motion-fast)] hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-floating)]">
      <article
        className="grid h-full grid-rows-[auto_auto_auto_1fr_auto]"
        data-testid="vehicle-card"
      >
        <VehiclePhoto
          image={vehicle.primaryImage}
          model={vehicle.model}
          city={vehicle.city}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
        />
        <header className="flex items-start gap-3 border-b border-[var(--color-border)] p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <FiTruck aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-[var(--color-text)]">
                  {vehicle.model}
                </h2>
                <p className="mt-0.5 text-xs font-semibold tracking-wide text-[var(--color-text-tertiary)]">
                  {vehicle.internalNumber}
                  {vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ''}
                </p>
              </div>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-sm text-[var(--color-text-secondary)]">
              <FiMapPin aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>{[vehicle.city, vehicle.office].filter(Boolean).join(' · ')}</span>
            </p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-[var(--color-border)] px-4 py-3 text-sm sm:grid-cols-4">
          <span>
            <strong className="block text-xs text-[var(--color-text-tertiary)]">Коробка</strong>
            {vehicle.transmission}
          </span>
          <span>
            <strong className="block text-xs text-[var(--color-text-tertiary)]">Двигатель</strong>
            {vehicle.engineLiters ? `${vehicle.engineLiters} л` : 'Нет данных'}
          </span>
          <span>
            <strong className="block text-xs text-[var(--color-text-tertiary)]">Топливо</strong>
            {fuelLabels[vehicle.fuelType]}
          </span>
          <span>
            <strong className="block text-xs text-[var(--color-text-tertiary)]">Мест</strong>
            <span className="inline-flex items-center gap-1">
              <FiUsers aria-hidden="true" />
              {vehicle.seats}
            </span>
          </span>
        </div>

        <div className="grid content-start gap-3 p-4">
          <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-lg)] bg-[var(--color-elevated)] p-3 text-sm">
            <span className="flex gap-2">
              <FiActivity aria-hidden="true" className="mt-0.5 text-[var(--color-primary)]" />
              <span>
                <strong className="block text-xs text-[var(--color-text-tertiary)]">Пробег</strong>
                {formatOptionalMetric(vehicle.telemetry.odometerKm, 'км')}
              </span>
            </span>
            <span className="flex gap-2">
              <FiDroplet aria-hidden="true" className="mt-0.5 text-[var(--color-primary)]" />
              <span>
                <strong className="block text-xs text-[var(--color-text-tertiary)]">Топливо</strong>
                {formatOptionalMetric(vehicle.telemetry.fuelLevelPercent, '%')}
              </span>
            </span>
            <span className="flex gap-2">
              <FiClock aria-hidden="true" className="mt-0.5 text-[var(--color-primary)]" />
              <span>
                <strong className="block text-xs text-[var(--color-text-tertiary)]">
                  Последняя связь
                </strong>
                {dateOrEmpty(vehicle.telemetry.lastSeenAt)}
              </span>
            </span>
            <span className="flex gap-2">
              <FiCalendar aria-hidden="true" className="mt-0.5 text-[var(--color-primary)]" />
              <span>
                <strong className="block text-xs text-[var(--color-text-tertiary)]">
                  Последняя поездка
                </strong>
                {dateOrEmpty(vehicle.telemetry.lastTripAt)}
              </span>
            </span>
          </div>
          {vehicle.features.length ? (
            <div className="flex flex-wrap gap-1.5">
              {vehicle.features.slice(0, 3).map((feature) => (
                <Badge key={feature}>{feature}</Badge>
              ))}
              {vehicle.features.length > 3 ? <Badge>+{vehicle.features.length - 3}</Badge> : null}
            </div>
          ) : null}
        </div>

        <footer className="grid gap-3 border-t border-[var(--color-border)] p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--color-text-tertiary)]">Стоимость аренды</span>
            <strong className="text-base text-[var(--color-text)]">
              {formatDailyPrice(vehicle.dailyPriceMinor, vehicle.currency)}
            </strong>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Link
              href={`/vehicles/${vehicle.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 text-sm font-semibold text-[var(--color-text-inverse)] transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              Открыть
            </Link>
            <Button
              variant="secondary"
              size="sm"
              aria-label={
                vehicle.telemetry.hasPosition
                  ? 'Показать на карте'
                  : 'Почему автомобиль не на карте'
              }
              leadingIcon={<FiMap aria-hidden="true" />}
              onClick={explainMissingPosition}
            >
              На карте
            </Button>
            <Link
              href={`/vehicles/${vehicle.id}?tab=trips`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              <FiNavigation aria-hidden="true" /> История
            </Link>
            <Link
              href={`/vehicles/${vehicle.id}?tab=routes`}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              Маршруты
            </Link>
          </div>
        </footer>
      </article>
    </Card>
  );
}
