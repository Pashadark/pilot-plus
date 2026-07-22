'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

import { Button, Card, IconButton } from '@/shared/ui';

import { buildCalendarMonth, groupCalendarEvents } from './calendar-model';
import {
  CalendarEventDialog,
  CalendarEventIcon,
  formatCalendarEventTime,
} from './CalendarEventDialog';
import type { CalendarDay, OperationsCalendarEvent } from './types';

const weekdays = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
] as const;

const eventToneClasses: Record<OperationsCalendarEvent['tone'], string> = {
  neutral:
    'border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-text-secondary)]',
  primary:
    'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  success:
    'border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]',
  warning:
    'border-[var(--color-warning)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  danger: 'border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
};

const agendaDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
  weekday: 'long',
});

function shiftCalendarMonth(month: string, offset: -1 | 1) {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const monthIndex = year * 12 + monthNumber - 1;
  const shiftedIndex = Math.min(9999 * 12 + 11, Math.max(0, monthIndex + offset));
  const shiftedYear = Math.floor(shiftedIndex / 12);
  const shiftedMonth = (shiftedIndex % 12) + 1;

  return `${String(shiftedYear).padStart(4, '0')}-${String(shiftedMonth).padStart(2, '0')}`;
}

function calendarDate(isoDate: string) {
  const match = /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date;
}

function formatAgendaDate(isoDate: string) {
  const date = calendarDate(isoDate);
  if (!date || Number.isNaN(date.getTime())) return isoDate;
  const label = agendaDateFormatter.format(date);
  return `${label[0]?.toUpperCase() ?? ''}${label.slice(1)}`;
}

function EventButton({ event, onClick }: { event: OperationsCalendarEvent; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${event.title}, ${event.vehicleLabel}, ${event.statusLabel}, ${formatCalendarEventTime(event)}`}
      className={`min-h-11 w-full min-w-0 cursor-pointer rounded-[var(--radius-sm)] border px-2 py-1.5 text-left text-xs transition-colors duration-[var(--motion-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] active:opacity-80 motion-reduce:transition-none ${eventToneClasses[event.tone]}`}
    >
      <span className="flex min-w-0 items-center gap-1.5 font-semibold">
        <CalendarEventIcon icon={event.icon} />
        <time className="shrink-0 tabular-nums" dateTime={event.startsAt}>
          {formatCalendarEventTime(event)}
        </time>
        <span className="truncate text-[var(--color-text)]">{event.title}</span>
      </span>
      <span className="mt-0.5 block truncate">{event.vehicleLabel}</span>
      <span
        data-testid="operations-calendar-event-status"
        className="mt-0.5 block truncate font-medium"
      >
        {event.statusLabel}
      </span>
    </button>
  );
}

function DayEvents({
  day,
  expanded,
  onExpand,
  onSelect,
}: {
  day: CalendarDay;
  expanded: boolean;
  onExpand: () => void;
  onSelect: (event: OperationsCalendarEvent) => void;
}) {
  const visibleEvents = expanded ? day.events : day.events.slice(0, 3);
  const hiddenCount = day.events.length - visibleEvents.length;

  return (
    <div className="grid min-w-0 gap-1.5">
      {visibleEvents.map((event) => (
        <EventButton key={event.id} event={event} onClick={() => onSelect(event)} />
      ))}
      {hiddenCount > 0 ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onExpand}
          className="min-h-11 min-w-11 cursor-pointer rounded-[var(--radius-sm)] px-2 text-left text-xs font-semibold text-[var(--color-primary)] transition-colors duration-[var(--motion-fast)] hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] active:bg-[var(--color-primary-soft)] motion-reduce:transition-none"
        >
          Ещё {hiddenCount}
        </button>
      ) : null}
    </div>
  );
}

export interface OperationsCalendarProps {
  events: readonly OperationsCalendarEvent[];
  month: string;
  onMonthChange: (month: string) => void;
  onToday: () => void;
  onEventAction?: (event: OperationsCalendarEvent) => ReactNode;
}

export function OperationsCalendar({
  events,
  month,
  onMonthChange,
  onToday,
  onEventAction,
}: OperationsCalendarProps) {
  const titleId = useId();
  const [expandedDays, setExpandedDays] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedEvent, setSelectedEvent] = useState<OperationsCalendarEvent | null>(null);
  const calendarMonth = useMemo(() => buildCalendarMonth(month), [month]);
  const eventGroups = useMemo(() => groupCalendarEvents(events), [events]);
  const days = useMemo(
    () =>
      calendarMonth.days.map((day) => ({
        ...day,
        events: eventGroups.get(day.isoDate) ?? [],
      })),
    [calendarMonth.days, eventGroups],
  );
  const agendaDays = days.filter((day) => day.inCurrentMonth && day.events.length > 0);

  function toggleDay(isoDate: string) {
    setExpandedDays((current) => {
      const next = new Set(current);
      if (next.has(isoDate)) next.delete(isoDate);
      else next.add(isoDate);
      return next;
    });
  }

  return (
    <section className="min-w-0" aria-labelledby={titleId}>
      <header className="mb-4 flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
        <h2
          id={titleId}
          className="mr-auto min-w-0 text-xl font-semibold text-[var(--color-text)] capitalize"
        >
          {calendarMonth.label}
        </h2>
        <div
          role="group"
          className="flex min-w-0 flex-wrap items-center gap-2"
          aria-label="Навигация по календарю"
        >
          <IconButton
            label="Предыдущий месяц"
            variant="secondary"
            onClick={() => onMonthChange(shiftCalendarMonth(calendarMonth.month, -1))}
            disabled={calendarMonth.month === '0000-01'}
          >
            <FiChevronLeft aria-hidden="true" className="size-5" />
          </IconButton>
          <Button variant="secondary" onClick={onToday}>
            Сегодня
          </Button>
          <IconButton
            label="Следующий месяц"
            variant="secondary"
            onClick={() => onMonthChange(shiftCalendarMonth(calendarMonth.month, 1))}
            disabled={calendarMonth.month === '9999-12'}
          >
            <FiChevronRight aria-hidden="true" className="size-5" />
          </IconButton>
        </div>
      </header>

      <div
        data-testid="operations-calendar-grid"
        aria-label={`Календарь: ${calendarMonth.label}`}
        className="hidden min-w-0 grid-cols-7 overflow-hidden rounded-[var(--radius-panel)] border border-r-0 border-b-0 bg-[var(--color-surface)] shadow-[var(--shadow-card)] md:grid"
      >
        {weekdays.map((weekday) => (
          <div
            key={weekday}
            className="min-w-0 border-r border-b bg-[var(--color-elevated)] px-2 py-3 text-center text-xs font-semibold text-[var(--color-text-secondary)]"
          >
            {weekday}
          </div>
        ))}
        {days.map((day) => (
          <div
            key={day.isoDate}
            aria-current={day.isToday ? 'date' : undefined}
            className={`min-h-36 min-w-0 overflow-hidden border-r border-b p-2 ${day.inCurrentMonth ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-elevated)] text-[var(--color-text-tertiary)]'}`}
          >
            <div className="mb-2 flex min-h-7 items-center justify-between gap-1">
              <time
                dateTime={day.isoDate}
                className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${day.isToday ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]' : ''}`}
              >
                {day.dayNumber}
              </time>
              {day.events.length > 0 ? (
                <span className="text-xs text-[var(--color-text-tertiary)] tabular-nums">
                  {day.events.length}
                </span>
              ) : null}
            </div>
            <DayEvents
              day={day}
              expanded={expandedDays.has(day.isoDate)}
              onExpand={() => toggleDay(day.isoDate)}
              onSelect={setSelectedEvent}
            />
          </div>
        ))}
      </div>

      <div
        data-testid="operations-calendar-agenda"
        aria-label={`Повестка: ${calendarMonth.label}`}
        className="grid min-w-0 gap-3 md:hidden"
      >
        {agendaDays.length ? (
          agendaDays.map((day) => (
            <Card key={day.isoDate} className="min-w-0 overflow-hidden p-3">
              <h3 className="mb-3 font-semibold break-words text-[var(--color-text)]">
                <time dateTime={day.isoDate}>{formatAgendaDate(day.isoDate)}</time>
              </h3>
              <DayEvents
                day={day}
                expanded={expandedDays.has(day.isoDate)}
                onExpand={() => toggleDay(day.isoDate)}
                onSelect={setSelectedEvent}
              />
            </Card>
          ))
        ) : (
          <Card className="min-w-0 p-6 text-center">
            <p className="font-semibold text-[var(--color-text)]">Записей на этот месяц нет</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Выберите другой месяц или вернитесь к сегодняшней дате.
            </p>
          </Card>
        )}
      </div>

      <CalendarEventDialog
        event={selectedEvent}
        open={selectedEvent !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null);
        }}
        action={selectedEvent && onEventAction ? onEventAction(selectedEvent) : undefined}
      />
    </section>
  );
}
