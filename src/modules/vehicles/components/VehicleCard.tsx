'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  FiCalendar,
  FiClock,
  FiCpu,
  FiDroplet,
  FiActivity,
  FiFileText,
  FiGitBranch,
  FiMap,
  FiMapPin,
  FiNavigation,
  FiTruck,
  FiTool,
  FiUser,
  FiUsers,
} from 'react-icons/fi';

import type { VehicleCardDto } from '../types';
import { formatDailyPrice, formatOptionalMetric } from '../utils';
import { FuelLevelBar } from './FuelLevelBar';
import { ServicePlanMeter } from '@/modules/maintenance/components/ServicePlanMeter';
import { VehiclePhoto } from './VehiclePhoto';
import { VehiclePopularityMedal } from './VehiclePopularityMedal';
import { PILOT_BUSINESS_TIME_ZONE } from '@/shared/business-time';
import { useToast } from '@/shared/providers/ToastProvider';
import { Badge, Button, Card } from '@/shared/ui';

const fuelLabels = {
  PETROL: 'Бензин',
  DIESEL: 'Дизель',
  ELECTRIC: 'Электричество',
  HYBRID: 'Гибрид',
  OTHER: 'Другое',
} as const;

function dateOrEmpty(value: string | null) {
  if (!value) return 'Нет данных';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: PILOT_BUSINESS_TIME_ZONE,
  }).format(new Date(value));
}

function rentalDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeZone: PILOT_BUSINESS_TIME_ZONE,
  }).format(new Date(value));
}

function rentalTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: PILOT_BUSINESS_TIME_ZONE,
  }).format(new Date(value));
}

function formatConsumption(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Нет данных';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)} л/100 км`;
}

function Specification({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <span className="flex min-w-0 gap-2">
      <span className="mt-0.5 shrink-0 text-[var(--color-primary)]">{icon}</span>
      <span className="min-w-0">
        <strong className="block text-xs text-[var(--color-text-tertiary)]">{label}</strong>
        <span className="block">{value}</span>
      </span>
    </span>
  );
}

export function VehicleCard({ vehicle }: { vehicle: VehicleCardDto }) {
  const { showToast } = useToast();
  const businessStatus = vehicle.activeRental
    ? { label: 'В аренде', tone: 'warning' as const }
    : vehicle.status === 'MAINTENANCE'
      ? { label: 'В ремонте', tone: 'info' as const }
      : { label: 'Свободна', tone: 'success' as const };

  const explainMissingPosition = () => {
    if (vehicle.telemetry.hasPosition) return;
    showToast({
      tone: 'info',
      title: 'Координаты пока не получены',
      description: `${vehicle.model} появится на карте после первого сигнала GPS-трекера.`,
    });
  };

  return (
    <Card className="min-w-0 overflow-hidden transition-[border-color,box-shadow] duration-[var(--motion-fast)] hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-floating)]">
      <article className="flex h-full flex-col" data-testid="vehicle-card">
        <div className="relative">
          <VehiclePhoto
            image={vehicle.primaryImage}
            model={vehicle.model}
            city={vehicle.city}
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
          {vehicle.popularityRank ? (
            <span className="pointer-events-none absolute top-2.5 right-2.5 z-10 sm:top-3 sm:right-3">
              <VehiclePopularityMedal rank={vehicle.popularityRank} />
            </span>
          ) : null}
        </div>
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
                <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs font-semibold tracking-wide text-[var(--color-text-tertiary)]">
                  <span>{vehicle.internalNumber}</span>
                  {vehicle.registrationNumber ? <span>{vehicle.registrationNumber}</span> : null}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                <Badge
                  tone={vehicle.gpsStatus.tone === 'muted' ? 'neutral' : vehicle.gpsStatus.tone}
                  data-testid="vehicle-gps-status"
                >
                  {vehicle.gpsStatus.label}
                </Badge>
                <Badge tone={businessStatus.tone}>{businessStatus.label}</Badge>
              </div>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-sm text-[var(--color-text-secondary)]">
              <FiMapPin aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>{vehicle.telemetry.address?.trim() || 'GPS-адрес пока не получен'}</span>
            </p>
          </div>
        </header>

        {vehicle.activeRental ? (
          <div className="px-4 pt-4">
            <Link
              data-testid="vehicle-active-rental"
              href={`/rentals/${vehicle.activeRental.id}`}
              className="flex min-h-28 items-center gap-4 rounded-[var(--radius-xl)] bg-[var(--color-warning-soft)] px-4 py-4 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--color-surface)] text-2xl text-[var(--color-warning)] shadow-sm">
                <FiUser aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-base leading-tight text-[var(--color-text)]">
                  {vehicle.activeRental.clientName}
                </strong>
                <span className="mt-2 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <FiFileText aria-hidden="true" className="shrink-0" />
                  <span className="text-[var(--color-text-tertiary)]">Договор</span>
                  <span className="font-medium text-[var(--color-text)]">
                    {vehicle.activeRental.contractNumber || 'Без номера'}
                  </span>
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-[var(--color-text-secondary)]">
                  <FiCalendar aria-hidden="true" className="shrink-0" />
                  <span className="text-[var(--color-text-tertiary)]">Возврат</span>
                  <span className="font-medium text-[var(--color-text)]">
                    {rentalDate(vehicle.activeRental.endsAt)}
                  </span>
                  <FiClock aria-hidden="true" className="ml-1 shrink-0" />
                  <span className="font-medium text-[var(--color-text)]">
                    {rentalTime(vehicle.activeRental.endsAt)}
                  </span>
                </span>
              </span>
            </Link>
          </div>
        ) : null}

        <section
          data-testid="vehicle-specifications"
          aria-label="Характеристики автомобиля"
          className="mx-4 mt-4 rounded-[var(--radius-lg)] bg-[var(--color-elevated)] p-3 text-sm"
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
            <Specification
              icon={<FiGitBranch aria-hidden="true" />}
              label="Коробка"
              value={vehicle.transmission}
            />
            <Specification
              icon={<FiCpu aria-hidden="true" />}
              label="Двигатель"
              value={vehicle.engineLiters ? `${vehicle.engineLiters} л` : 'Нет данных'}
            />
            <Specification
              icon={<FiDroplet aria-hidden="true" />}
              label="Топливо"
              value={fuelLabels[vehicle.fuelType]}
            />
            <Specification
              icon={<FiCalendar aria-hidden="true" />}
              label="Год"
              value={vehicle.manufacturedYear ?? 'Нет данных'}
            />
            <Specification
              icon={<FiNavigation aria-hidden="true" />}
              label="Привод"
              value={vehicle.driveType || 'Нет данных'}
            />
            <Specification
              icon={<FiUsers aria-hidden="true" />}
              label="Мест"
              value={vehicle.seats}
            />
          </div>
          <div className="mt-4">
            <Specification
              icon={<FiActivity aria-hidden="true" />}
              label="Расход"
              value={formatConsumption(vehicle.fuelConsumptionLitersPer100Km)}
            />
          </div>
        </section>

        <section
          data-testid="vehicle-telemetry"
          aria-label="Телематика автомобиля"
          className="mx-4 mt-3 grid flex-1 grid-cols-2 content-start gap-x-4 gap-y-4 rounded-[var(--radius-lg)] bg-[var(--color-elevated)] p-3 text-sm"
        >
          <span className="flex gap-2">
            <FiActivity aria-hidden="true" className="mt-0.5 text-[var(--color-primary)]" />
            <span>
              <strong className="block text-xs text-[var(--color-text-tertiary)]">Пробег</strong>
              {formatOptionalMetric(vehicle.telemetry.odometerKm, 'км')}
            </span>
          </span>
          <span className="flex min-w-0 gap-2">
            <FiDroplet aria-hidden="true" className="mt-0.5 text-[var(--color-primary)]" />
            <span className="min-w-0 flex-1">
              <strong className="block text-xs text-[var(--color-text-tertiary)]">Топливо</strong>
              <FuelLevelBar value={vehicle.telemetry.fuelLevelPercent} />
            </span>
          </span>
          <div className="flex min-w-0 gap-2">
            <FiTool aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
            <ServicePlanMeter vehicleId={vehicle.id} compact />
          </div>
          <span className="flex gap-2">
            <FiClock aria-hidden="true" className="mt-0.5 text-[var(--color-primary)]" />
            <span>
              <strong className="block text-xs text-[var(--color-text-tertiary)]">
                Последний сигнал
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
        </section>

        <footer className="grid gap-3 p-4">
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
            {vehicle.telemetry.hasPosition ? (
              <Link
                href={`/map?vehicleId=${encodeURIComponent(vehicle.id)}`}
                aria-label="Показать на карте"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              >
                <FiMap aria-hidden="true" /> На карте
              </Link>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                aria-label="Почему автомобиль не на карте"
                leadingIcon={<FiMap aria-hidden="true" />}
                onClick={explainMissingPosition}
              >
                На карте
              </Button>
            )}
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
