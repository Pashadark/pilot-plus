'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiExternalLink,
  FiMapPin,
  FiTruck,
  FiX,
} from 'react-icons/fi';

import type { VehicleGpsStatusTone } from '@/modules/vehicles/gps-status';
import { formatDailyPrice } from '@/modules/vehicles/utils';
import { IconButton } from '@/shared/ui/IconButton';

import type { OnlineMapVehicle } from '../types';

const statusClasses: Record<VehicleGpsStatusTone, string> = {
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  primary: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  muted: 'bg-[var(--color-elevated)] text-[var(--color-text-secondary)]',
};

const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const returnDate = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const DEPOSIT_LABELS: Record<
  NonNullable<NonNullable<OnlineMapVehicle['currentRental']>['depositState']>,
  string
> = {
  NOT_COLLECTED: 'Залог не внесён',
  COLLECTED: 'Залог внесён',
  RETURNED: 'Залог возвращён',
  PARTIALLY_WITHHELD: 'Залог частично удержан',
  WITHHELD: 'Залог удержан',
};

const DEPOSIT_CLASSES: Record<
  NonNullable<NonNullable<OnlineMapVehicle['currentRental']>['depositState']>,
  string
> = {
  NOT_COLLECTED: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  COLLECTED: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  RETURNED: 'bg-[var(--color-elevated)] text-[var(--color-text-secondary)]',
  PARTIALLY_WITHHELD: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  WITHHELD: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
};

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-3">
      <dt className="text-[10px] font-medium tracking-[0.05em] text-[var(--color-text-secondary)] uppercase">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold">{value}</dd>
    </div>
  );
}

export interface SelectedVehiclePanelProps {
  vehicle: OnlineMapVehicle;
  onClose: () => void;
  trackControls: ReactNode;
  trackSummary: ReactNode;
  trackSegments: ReactNode;
  trackEvents: ReactNode;
  mobileCollapsed?: boolean;
  onMobileCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}

export function SelectedVehiclePanel({
  vehicle,
  onClose,
  trackControls,
  trackSummary,
  trackSegments,
  trackEvents,
  mobileCollapsed = false,
  onMobileCollapsedChange = () => undefined,
  className = '',
}: SelectedVehiclePanelProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const rental = vehicle.currentRental;
  const showImage = Boolean(vehicle.image && !imageFailed);
  const hasFreshPosition = vehicle.gpsStatus.key !== 'NO_DATA' && vehicle.gpsStatus.key !== 'STALE';

  return (
    <aside
      data-testid="selected-vehicle-panel"
      data-mobile-collapsed={mobileCollapsed}
      aria-label="Выбранный автомобиль"
      className={`flex flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-floating)] ${className}`}
    >
      <header className="relative border-b border-[var(--color-border)]">
        <div className="relative h-32 overflow-hidden bg-[var(--color-elevated)] @min-[48rem]:h-40">
          {showImage && vehicle.image ? (
            <Image
              src={vehicle.image.src}
              alt={vehicle.image.alt || vehicle.name}
              fill
              unoptimized
              sizes="(min-width: 48rem) 25rem, 100vw"
              className="object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div
              role="img"
              aria-label={`Фотография ${vehicle.name} отсутствует`}
              className="grid size-full place-items-center text-[var(--color-text-secondary)]"
            >
              <FiTruck aria-hidden="true" className="size-10" />
            </div>
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(to_top,rgb(9_9_11/0.88),transparent_68%)]"
          />
          <div className="absolute top-2 right-2 flex gap-1">
            <IconButton
              label={
                mobileCollapsed ? 'Развернуть карточку автомобиля' : 'Свернуть карточку автомобиля'
              }
              variant="ghost"
              size="sm"
              onClick={() => onMobileCollapsedChange(!mobileCollapsed)}
              className="shrink-0 bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)] backdrop-blur @min-[48rem]:hidden"
            >
              {mobileCollapsed ? (
                <FiChevronUp aria-hidden="true" className="size-5" />
              ) : (
                <FiChevronDown aria-hidden="true" className="size-5" />
              )}
            </IconButton>
            <IconButton
              label="Закрыть карточку автомобиля"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="shrink-0 bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)] backdrop-blur"
            >
              <FiX aria-hidden="true" className="size-5" />
            </IconButton>
          </div>
          <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3 text-white">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold">{vehicle.name}</h2>
              <p className="text-sm font-semibold">{vehicle.plate}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClasses[vehicle.gpsStatus.tone]}`}
            >
              {vehicle.gpsStatus.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5">
          <Link
            href={`/vehicles/${vehicle.id}`}
            aria-label="Открыть карточку автомобиля"
            className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-xs font-semibold transition-colors hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            Карточка автомобиля <FiExternalLink aria-hidden="true" />
          </Link>
          {rental ? (
            <Link
              href={`/rentals/${rental.id}`}
              aria-label="Открыть договор аренды"
              className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              Договор <FiExternalLink aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </header>

      <div
        className={`min-h-0 flex-1 overflow-y-auto ${mobileCollapsed ? 'hidden @min-[48rem]:block' : ''}`}
      >
        <article className="grid gap-4 p-4">
          <dl className="grid grid-cols-2 gap-2">
            <Metric
              label="Скорость"
              value={
                !hasFreshPosition
                  ? 'Нет данных'
                  : vehicle.speedKph === 0
                    ? 'Стоит'
                    : `${vehicle.speedKph} км/ч`
              }
            />
            <Metric
              label="Топливо"
              value={
                vehicle.fuelPercent === null
                  ? 'Нет данных'
                  : `${number.format(vehicle.fuelPercent)}%`
              }
            />
            <Metric
              label="Одометр"
              value={
                vehicle.odometerKm === null || vehicle.odometerKm === undefined
                  ? 'Нет данных'
                  : `${number.format(vehicle.odometerKm)} км`
              }
            />
            <Metric label="Связь" value={vehicle.lastSeenLabel} />
          </dl>

          {rental ? (
            <section
              aria-label="Активная аренда"
              className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-elevated)] p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.06em] text-[var(--color-text-secondary)] uppercase">
                    Активная аренда
                  </p>
                  {rental.clientId ? (
                    <Link
                      href={`/clients/${rental.clientId}`}
                      className="mt-1 block truncate font-semibold hover:text-[var(--color-primary)]"
                    >
                      {rental.clientName}
                    </Link>
                  ) : (
                    <p className="mt-1 truncate font-semibold">{rental.clientName}</p>
                  )}
                  {rental.contractNumber ? (
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {rental.contractNumber}
                    </p>
                  ) : null}
                </div>
                {rental.depositState ? (
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${DEPOSIT_CLASSES[rental.depositState]}`}
                  >
                    {DEPOSIT_LABELS[rental.depositState]}
                  </span>
                ) : null}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--color-border)] pt-3 text-xs">
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Тариф</dt>
                  <dd className="mt-0.5 font-semibold">
                    {rental.dailyRateMinor === undefined || !rental.currency
                      ? 'Не указан'
                      : formatDailyPrice(rental.dailyRateMinor, rental.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Возврат</dt>
                  <dd className="mt-0.5 font-semibold">
                    {rental.endsAt ? returnDate.format(new Date(rental.endsAt)) : 'Не указан'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Лимит пробега</dt>
                  <dd className="mt-0.5 font-semibold">
                    {rental.includedMileageKm === null || rental.includedMileageKm === undefined
                      ? 'Не задан'
                      : `${number.format(rental.includedMileageKm)} км/сутки`}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Сегодня</dt>
                  <dd className="mt-0.5 font-semibold">
                    {vehicle.dailyDistanceKm === null || vehicle.dailyDistanceKm === undefined
                      ? 'Нет данных'
                      : `${number.format(vehicle.dailyDistanceKm)} км`}
                  </dd>
                </div>
              </dl>
            </section>
          ) : (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-3 text-sm text-[var(--color-text-secondary)]">
              Нет активной аренды
            </p>
          )}

          <section aria-label="Текущее местоположение" className="grid gap-2 text-sm">
            <p className="flex gap-2 text-[var(--color-text-secondary)]">
              <FiMapPin
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-[var(--color-primary)]"
              />
              <span>{vehicle.address}</span>
            </p>
            <p className="flex gap-2 text-[var(--color-text-secondary)]">
              <FiClock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>Последний сигнал: {vehicle.lastSeenLabel}</span>
            </p>
          </section>

          <div className="border-t border-[var(--color-border)] pt-4">{trackControls}</div>
          {trackSummary}
          {trackSegments}
          {trackEvents}
        </article>
      </div>
    </aside>
  );
}
