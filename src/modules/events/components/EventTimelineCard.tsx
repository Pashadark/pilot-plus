'use client';

import Link from 'next/link';
import { FiAlertTriangle, FiCheck, FiClock, FiMapPin } from 'react-icons/fi';

import type { TimelineEventDto } from '../types';
import { Badge, Button, Card } from '@/shared/ui';

const severityLabel = { INFO: 'Информация', WARNING: 'Предупреждение', DANGER: 'Критическое' };
const severityTone = { INFO: 'info', WARNING: 'warning', DANGER: 'danger' } as const;
const categoryLabel = {
  MOVEMENT: 'Движение',
  TRIP: 'Поездка',
  STOP: 'Остановка',
  ALERT: 'Тревога',
  FUEL: 'Топливо',
  MAINTENANCE: 'ТО',
  WASH: 'Мойка',
  DEVICE: 'Устройство',
  FIRMWARE: 'Прошивка',
  MANUAL: 'Ручная запись',
};

const headingLabels = [
  'Север',
  'Северо-восток',
  'Восток',
  'Юго-восток',
  'Юг',
  'Юго-запад',
  'Запад',
  'Северо-запад',
];

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value);
}

function formatHeading(value: number) {
  const normalized = ((value % 360) + 360) % 360;
  const label = headingLabels[Math.round(normalized / 45) % headingLabels.length];
  return `${label} (${formatNumber(normalized)}°)`;
}

export function EventTimelineCard({
  event,
  onMarkRead,
  pending = false,
}: {
  event: TimelineEventDto;
  onMarkRead?: (key: string) => void;
  pending?: boolean;
}) {
  const time = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(event.recordedAt),
  );
  return (
    <Card
      data-testid="timeline-event"
      className={`min-w-0 p-4 ${event.isRead ? '' : 'border-[var(--color-primary)]'}`}
    >
      <div className="flex min-w-0 gap-3">
        <span
          className={`mt-1 grid size-11 shrink-0 place-items-center rounded-full ${event.severity === 'DANGER' ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]' : 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'}`}
        >
          {event.severity === 'DANGER' ? (
            <FiAlertTriangle aria-hidden="true" />
          ) : (
            <FiClock aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={severityTone[event.severity]}>{severityLabel[event.severity]}</Badge>
            <Badge tone="neutral">{categoryLabel[event.category]}</Badge>
            {!event.isRead ? (
              <span className="text-xs font-semibold text-[var(--color-primary)]">
                Не прочитано
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 font-semibold text-[var(--color-text)]">{event.title}</h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {event.vehicle.internalNumber} · {event.vehicle.model} · {time}
          </p>
          {event.description ? (
            <p className="mt-2 text-sm break-words">{event.description}</p>
          ) : null}
          {event.location ? (
            <p className="mt-2 flex gap-1 text-sm text-[var(--color-text-secondary)]">
              <FiMapPin aria-hidden="true" />
              {event.location}
            </p>
          ) : null}
          {event.telemetry.speedKph !== null ? (
            <p className="mt-2 text-sm">Скорость: {event.telemetry.speedKph} км/ч</p>
          ) : null}
          {event.telemetry.heading !== null ? (
            <p className="mt-1 text-sm">Направление: {formatHeading(event.telemetry.heading)}</p>
          ) : null}
          {event.telemetry.odometerKm !== null ? (
            <p className="mt-1 text-sm">Пробег: {formatNumber(event.telemetry.odometerKm)} км</p>
          ) : null}
          {event.telemetry.fuelLevelPercent !== null ? (
            <p className="mt-1 text-sm">
              Уровень топлива: {formatNumber(event.telemetry.fuelLevelPercent)} %
            </p>
          ) : null}
          {event.telemetry.fuelVolumeLiters !== null ? (
            <p className="mt-1 text-sm">
              Объём топлива: {formatNumber(event.telemetry.fuelVolumeLiters)} л
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {event.source.href ? (
              <Link
                href={event.source.href}
                className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--color-primary)]"
              >
                Открыть источник
              </Link>
            ) : null}
            {!event.isRead && onMarkRead ? (
              <Button
                variant="ghost"
                size="sm"
                loading={pending}
                onClick={() => onMarkRead(event.key)}
                leadingIcon={<FiCheck aria-hidden="true" />}
              >
                Отметить прочитанным
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
