'use client';

import type { ReactNode } from 'react';
import { FiDroplet, FiTool } from 'react-icons/fi';

import { PILOT_BUSINESS_TIME_ZONE } from '@/shared/business-time';
import { Badge, Button, Modal } from '@/shared/ui';

import type { OperationsCalendarEvent } from './types';

const eventDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  timeZone: PILOT_BUSINESS_TIME_ZONE,
  year: 'numeric',
});

const eventTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: PILOT_BUSINESS_TIME_ZONE,
});

function eventInstant(event: OperationsCalendarEvent) {
  return new Date(event.startsAt);
}

export function formatCalendarEventDate(event: OperationsCalendarEvent) {
  const instant = eventInstant(event);
  return Number.isNaN(instant.getTime()) ? 'Дата не указана' : eventDateFormatter.format(instant);
}

export function formatCalendarEventTime(event: OperationsCalendarEvent) {
  const instant = eventInstant(event);
  return Number.isNaN(instant.getTime()) ? '—' : eventTimeFormatter.format(instant);
}

export function CalendarEventIcon({ icon }: Pick<OperationsCalendarEvent, 'icon'>) {
  return icon === 'tool' ? (
    <FiTool aria-hidden="true" className="size-4 shrink-0" />
  ) : (
    <FiDroplet aria-hidden="true" className="size-4 shrink-0" />
  );
}

export interface CalendarEventDialogProps {
  event: OperationsCalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: ReactNode;
  details?: ReactNode;
  status?: ReactNode;
}

export function CalendarEventDialog({
  event,
  open,
  onOpenChange,
  action,
  details,
  status,
}: CalendarEventDialogProps) {
  if (!event) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={event.title}
      description="Сведения о календарной записи."
      className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-x-hidden overflow-y-auto"
      footer={
        <div className="flex min-w-0 flex-wrap justify-end gap-3">
          {action}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </div>
      }
    >
      <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-[var(--color-text-secondary)]">Дата и время</dt>
          <dd className="mt-1 font-semibold break-words text-[var(--color-text)]">
            {formatCalendarEventDate(event)}, {formatCalendarEventTime(event)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[var(--color-text-secondary)]">Автомобиль</dt>
          <dd className="mt-1 font-semibold break-words text-[var(--color-text)]">
            {event.vehicleLabel}
          </dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-[var(--color-text-secondary)]">Статус</dt>
          <dd className="mt-2">
            {status !== undefined ? (
              status
            ) : (
              <Badge tone={event.tone} className="max-w-full gap-1.5">
                <CalendarEventIcon icon={event.icon} />
                <span className="break-words">{event.statusLabel}</span>
              </Badge>
            )}
          </dd>
        </div>
      </dl>
      {details ? <div className="mt-4 min-w-0 text-sm">{details}</div> : null}
    </Modal>
  );
}
