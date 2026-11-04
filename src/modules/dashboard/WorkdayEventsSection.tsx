'use client';
import { useEffect, useRef, useState } from 'react';
import { WorkdayDateStrip } from './WorkdayDateStrip';
import { WorkdayVehicleEvents } from './WorkdayVehicleEvents';
import { WorkdayFleetCalendar } from './WorkdayFleetCalendar';
import { dayKey, shiftDay } from './workday-calendar';
import { loadWorkdayEvents } from './day-actions';
import type {
  DashboardAttentionItemDto,
  DashboardFleetVehicle,
  DashboardWorkItemDto,
} from './overview-types';
import { buildWorkdayCarouselItems } from './workday-carousel';

export function WorkdayEventsSection({
  initialDay,
  today,
  initialItems,
  attentionItems,
  initialDayCount,
  fleet,
}: {
  initialDay: string;
  today: string;
  initialItems: DashboardWorkItemDto[];
  attentionItems: DashboardAttentionItemDto[];
  initialDayCount: number;
  fleet: DashboardFleetVehicle[];
}) {
  const [selected, setSelected] = useState(initialDay);
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sequence = useRef(0);
  const cache = useRef(
    new Map(
      Array.from({ length: Math.min(31, initialDayCount) }, (_, offset) => {
        const day = shiftDay(initialDay, offset);
        return [
          day,
          initialItems.filter(
            (item) => dayKey(item.scheduledAt) === day || (day === today && item.overdue),
          ),
        ] as const;
      }),
    ),
  );
  async function select(day: string) {
    const request = ++sequence.current;
    setSelected(day);
    setError(false);
    const cached = cache.current.get(day);
    if (cached) {
      setItems(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    setItems([]);
    try {
      const next = await loadWorkdayEvents(day);
      if (request === sequence.current) {
        cache.current.set(day, next);
        if (cache.current.size > 31) cache.current.delete(cache.current.keys().next().value!);
        setItems(next);
      }
    } catch {
      if (request === sequence.current) setError(true);
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  return (
    <>
      <section aria-label="Выдачи и возвраты выбранного дня">
        <div className="workday-section-heading workday-events-heading">
          <h2>
            {selected === today
              ? 'Сегодня'
              : new Intl.DateTimeFormat('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  timeZone: 'Europe/Moscow',
                }).format(new Date(`${selected}T12:00:00+03:00`))}
          </h2>
          <div className="workday-day-controls">
            <label className="sr-only" htmlFor="workday-date">
              Дата рабочего дня
            </label>
            <input
              id="workday-date"
              type="date"
              value={selected}
              onChange={(event) => {
                if (event.target.value) void select(event.target.value);
              }}
              className="min-h-11 max-w-36 rounded-xl border bg-[var(--color-surface)] px-2 text-sm"
            />
            <WorkdayDateStrip
              key={selected}
              selected={selected}
              onSelect={(day) => void select(day)}
            />
          </div>
        </div>
        <div aria-busy={loading}>
          {loading ? (
            <div role="status" className="workday-empty">
              Загружаем события дня…
            </div>
          ) : error ? (
            <div role="alert" className="workday-empty">
              Не удалось загрузить события.{' '}
              <button type="button" onClick={() => void select(selected)}>
                Повторить
              </button>
            </div>
          ) : (
            <WorkdayVehicleEvents
              items={buildWorkdayCarouselItems({
                items,
                attentionItems,
                selectedDay: selected,
                today,
              })}
              fleet={fleet}
            />
          )}
        </div>
      </section>
      <WorkdayFleetCalendar key={selected} fleet={fleet} selected={selected} />
    </>
  );
}
