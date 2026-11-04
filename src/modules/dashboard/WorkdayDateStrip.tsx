'use client';
import Link from 'next/link';
import { useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { calendarDays, shiftDay } from './workday-calendar';
export function WorkdayDateStrip({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect?: (day: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  return (
    <nav aria-label="Дни рабочего дня" className="workday-dates">
      <button type="button" aria-label="Предыдущие 7 дней" onClick={() => setOffset(offset - 7)}>
        <FiChevronLeft />
      </button>
      <div className="workday-dates-scroll">
        {calendarDays(shiftDay(selected, offset)).map((day) => (
          <Link
            key={day.key}
            href={`/?from=${day.key}`}
            prefetch={onSelect ? false : undefined}
            onClick={(event) => {
              if (!onSelect || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
                return;
              event.preventDefault();
              onSelect(day.key);
            }}
            aria-label={day.key}
            aria-current={selected === day.key ? 'date' : undefined}
          >
            <span>{day.label}</span>
            <small>{day.weekday}</small>
          </Link>
        ))}
      </div>
      <button type="button" aria-label="Следующие 7 дней" onClick={() => setOffset(offset + 7)}>
        <FiChevronRight />
      </button>
    </nav>
  );
}
