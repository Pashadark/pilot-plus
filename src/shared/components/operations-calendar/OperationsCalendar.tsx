'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

import { Button, Card, IconButton } from '@/shared/ui';

import { buildCalendarMonth, groupCalendarEvents } from './calendar-model';
import { CalendarEventDialog, formatCalendarEventTime } from './CalendarEventDialog';
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
  neutral: 'border-[var(--color-border)] bg-[var(--color-elevated)]',
  primary: 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]',
  success: 'border-[var(--color-success)] bg-[var(--color-success-soft)]',
  warning: 'border-[var(--color-warning)] bg-[var(--color-warning-soft)]',
  danger: 'border-[var(--color-danger)] bg-[var(--color-danger-soft)]',
};

const calendarDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
});

const calendarDayFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
  weekday: 'long',
  year: 'numeric',
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

function capitalizeLabel(label: string) {
  return `${label[0]?.toUpperCase() ?? ''}${label.slice(1)}`;
}

function formatCalendarDate(isoDate: string) {
  const date = calendarDate(isoDate);
  if (!date || Number.isNaN(date.getTime())) return isoDate;
  return calendarDateFormatter.format(date);
}

function formatCalendarDayLabel(isoDate: string) {
  const date = calendarDate(isoDate);
  if (!date || Number.isNaN(date.getTime())) return isoDate;
  return capitalizeLabel(calendarDayFormatter.format(date));
}

function EventButton({
  event,
  dayLabel,
  onClick,
}: {
  event: OperationsCalendarEvent;
  dayLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="operations-calendar-event"
      aria-label={`${dayLabel}, ${formatCalendarEventTime(event)}, ${event.title}, ${event.vehicleLabel}, статус: ${event.statusLabel}`}
      className={`min-h-11 w-full min-w-0 cursor-pointer rounded-[var(--radius-sm)] border border-l-4 px-2 py-1.5 text-left text-xs text-[var(--color-text)] transition-colors duration-[var(--motion-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] active:opacity-80 motion-reduce:transition-none ${eventToneClasses[event.tone]}`}
    >
      <span className="grid min-w-0 gap-1">
        <span className="flex min-w-0 items-center gap-1.5 font-semibold">
          <time className="shrink-0 tabular-nums" dateTime={event.startsAt}>
            {formatCalendarEventTime(event)}
          </time>
          <span className="truncate">{event.title}</span>
        </span>
        <span
          data-testid="operations-calendar-event-vehicle"
          className="block truncate text-[var(--color-text-secondary)]"
        >
          {event.vehicleLabel}
        </span>
      </span>
    </button>
  );
}

function DayEvents({
  day,
  dayLabel,
  expanded,
  announced,
  onExpand,
  onSelect,
}: {
  day: CalendarDay;
  dayLabel: string;
  expanded: boolean;
  announced: boolean;
  onExpand: () => void;
  onSelect: (event: OperationsCalendarEvent) => void;
}) {
  const listId = useId();
  const visibleEvents = expanded ? day.events : day.events.slice(0, 3);
  const overflowCount = Math.max(0, day.events.length - 3);

  return (
    <>
      <div id={listId} className="grid min-w-0 gap-1.5">
        {visibleEvents.map((event) => (
          <EventButton
            key={event.id}
            event={event}
            dayLabel={dayLabel}
            onClick={() => onSelect(event)}
          />
        ))}
      </div>
      {overflowCount > 0 ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={onExpand}
          className="min-h-11 min-w-11 cursor-pointer rounded-[var(--radius-sm)] px-2 text-left text-xs font-semibold text-[var(--color-primary)] transition-colors duration-[var(--motion-fast)] hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] active:bg-[var(--color-primary-soft)] motion-reduce:transition-none"
        >
          {expanded ? 'Скрыть' : `Ещё ${overflowCount}`}
        </button>
      ) : null}
      {announced && overflowCount > 0 ? (
        <p role="status" aria-live="polite" className="sr-only">
          {expanded
            ? `Показаны все ${day.events.length} записи за ${dayLabel.toLocaleLowerCase('ru-RU')}.`
            : `Показаны первые 3 из ${day.events.length} записей за ${dayLabel.toLocaleLowerCase('ru-RU')}.`}
        </p>
      ) : null}
    </>
  );
}

export interface OperationsCalendarProps {
  events: readonly OperationsCalendarEvent[];
  month: string;
  onMonthChange: (month: string) => void;
  onToday: () => void;
  onEventAction?: (event: OperationsCalendarEvent) => ReactNode;
  renderEventDetails?: (event: OperationsCalendarEvent) => ReactNode;
  renderEventStatus?: (event: OperationsCalendarEvent) => ReactNode;
}

export function OperationsCalendar({
  events,
  month,
  onMonthChange,
  onToday,
  onEventAction,
  renderEventDetails,
  renderEventStatus,
}: OperationsCalendarProps) {
  const titleId = useId();
  const [dayDisclosures, setDayDisclosures] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(),
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const eventIdsKey = JSON.stringify(events.map((event) => event.id));
  const [previousEventIdsKey, setPreviousEventIdsKey] = useState(eventIdsKey);

  if (eventIdsKey !== previousEventIdsKey) {
    setPreviousEventIdsKey(eventIdsKey);
    if (selectedEventId !== null && !events.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }

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
  const weeks = Array.from({ length: days.length / 7 }, (_, index) =>
    days.slice(index * 7, index * 7 + 7),
  );
  const weekdayIds = weekdays.map((_, index) => `${titleId}-weekday-${index}`);
  const selectedEvent =
    selectedEventId === null
      ? null
      : (events.find((event) => event.id === selectedEventId) ?? null);

  function toggleDay(isoDate: string) {
    setDayDisclosures((current) => {
      const next = new Map(current);
      next.set(isoDate, !(current.get(isoDate) ?? false));
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
        role="grid"
        data-testid="operations-calendar-grid"
        aria-label={`Календарь: ${calendarMonth.label}`}
        className="hidden min-w-0 grid-cols-7 overflow-hidden rounded-[var(--radius-panel)] border border-r-0 border-b-0 bg-[var(--color-surface)] shadow-[var(--shadow-card)] md:grid"
      >
        <div role="row" className="contents">
          {weekdays.map((weekday, index) => (
            <div
              key={weekday}
              id={weekdayIds[index]}
              role="columnheader"
              className="min-w-0 border-r border-b bg-[var(--color-elevated)] px-2 py-3 text-center text-xs font-semibold text-[var(--color-text-secondary)]"
            >
              {weekday}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]?.isoDate} role="row" className="contents">
            {week.map((day, weekdayIndex) => {
              const dateId = `${titleId}-date-${day.isoDate}`;
              const dayLabel = formatCalendarDayLabel(day.isoDate);
              const disclosureState = dayDisclosures.get(day.isoDate);

              return (
                <div
                  key={day.isoDate}
                  role="gridcell"
                  aria-labelledby={`${weekdayIds[weekdayIndex]} ${dateId}`}
                  aria-current={day.isToday ? 'date' : undefined}
                  className={`min-h-44 min-w-0 overflow-hidden border-r border-b p-2 ${day.inCurrentMonth ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'}`}
                >
                  <span id={dateId} className="sr-only">
                    {formatCalendarDate(day.isoDate)}
                  </span>
                  <div className="mb-2 flex min-h-7 items-center justify-between gap-1">
                    <time
                      aria-hidden="true"
                      dateTime={day.isoDate}
                      className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${day.isToday ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]' : ''}`}
                    >
                      {day.dayNumber}
                    </time>
                    {day.events.length > 0 ? (
                      <span
                        aria-hidden="true"
                        className="text-xs text-[var(--color-text-secondary)] tabular-nums"
                      >
                        {day.events.length}
                      </span>
                    ) : null}
                  </div>
                  <DayEvents
                    day={day}
                    dayLabel={dayLabel}
                    expanded={disclosureState ?? false}
                    announced={disclosureState !== undefined}
                    onExpand={() => toggleDay(day.isoDate)}
                    onSelect={(event) => setSelectedEventId(event.id)}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div
        data-testid="operations-calendar-agenda"
        aria-label={`Повестка: ${calendarMonth.label}`}
        className="grid min-w-0 gap-3 md:hidden"
      >
        {agendaDays.length ? (
          agendaDays.map((day) => {
            const headingId = `${titleId}-agenda-${day.isoDate}`;
            const dayLabel = formatCalendarDayLabel(day.isoDate);
            const disclosureState = dayDisclosures.get(day.isoDate);

            return (
              <Card
                key={day.isoDate}
                role="group"
                aria-labelledby={headingId}
                className="min-w-0 overflow-hidden p-3"
              >
                <h3
                  id={headingId}
                  className="mb-3 font-semibold break-words text-[var(--color-text)]"
                >
                  <time dateTime={day.isoDate}>{dayLabel}</time>
                </h3>
                <DayEvents
                  day={day}
                  dayLabel={dayLabel}
                  expanded={disclosureState ?? false}
                  announced={disclosureState !== undefined}
                  onExpand={() => toggleDay(day.isoDate)}
                  onSelect={(event) => setSelectedEventId(event.id)}
                />
              </Card>
            );
          })
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
          if (!open) setSelectedEventId(null);
        }}
        action={selectedEvent && onEventAction ? onEventAction(selectedEvent) : undefined}
        details={
          selectedEvent && renderEventDetails ? renderEventDetails(selectedEvent) : undefined
        }
        status={selectedEvent && renderEventStatus ? renderEventStatus(selectedEvent) : undefined}
      />
    </section>
  );
}
