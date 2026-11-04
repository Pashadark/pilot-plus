'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import type { DashboardFleetVehicle } from './overview-types';
import { calendarDays, rentalPlacement, shiftDay } from './workday-calendar';
export function WorkdayFleetCalendar({
  fleet,
  selected,
}: {
  fleet: DashboardFleetVehicle[];
  selected: string;
}) {
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(7);
  const [expanded, setExpanded] = useState(false);
  const start = shiftDay(selected, offset);
  const days = calendarDays(start, count);
  const sorted = [...fleet].sort(
    (a, b) =>
      Number(b.rentals.some((r) => rentalPlacement(r.startsAt, r.endsAt, start, count))) -
        Number(a.rentals.some((r) => rentalPlacement(r.startsAt, r.endsAt, start, count))) ||
      a.name.localeCompare(b.name),
  );
  return (
    <section aria-label="Занятость автопарка" className="workday-occupancy">
      <div className="workday-section-heading">
        <h2>Занятость автопарка</h2>
        <div className="workday-calendar-tools">
          <select
            aria-label="Масштаб занятости"
            value={count}
            onChange={(e) => {
              setCount(Number(e.target.value));
              setOffset(0);
            }}
          >
            <option value={7}>Неделя</option>
            <option value={14}>2 недели</option>
          </select>
          <button
            type="button"
            aria-label="Предыдущий период занятости"
            onClick={() => setOffset(offset - count)}
          >
            <FiChevronLeft />
          </button>
          <button
            type="button"
            aria-label="Следующий период занятости"
            onClick={() => setOffset(offset + count)}
          >
            <FiChevronRight />
          </button>
        </div>
      </div>
      <div className="workday-calendar-scroll">
        <div className="workday-calendar" style={{ minWidth: count === 7 ? 700 : 1100 }}>
          <div
            className="workday-calendar-row workday-calendar-head"
            style={{ gridTemplateColumns: `210px repeat(${count},minmax(0,1fr))` }}
          >
            <span>Автомобиль</span>
            {days.map((d) => (
              <span key={d.key} data-selected={d.key === selected}>
                {d.label}
                <small>{d.weekday}</small>
              </span>
            ))}
          </div>
          {(expanded ? sorted : sorted.slice(0, 4)).map((v) => {
            const bookings = v.rentals
              .map((r) => ({
                ...r,
                placement: rentalPlacement(r.startsAt, r.endsAt, start, count),
              }))
              .filter((r) => r.placement);
            return (
              <div
                key={v.id}
                className="workday-calendar-row"
                style={{ gridTemplateColumns: '210px minmax(0,1fr)' }}
              >
                <Link href={`/vehicles/${v.id}`} className="workday-calendar-car">
                  {v.image && (
                    <Image
                      src={v.image.localPath}
                      alt={v.image.alt}
                      width={80}
                      height={52}
                      unoptimized={!v.image.localPath.startsWith('/vehicles/promo/')}
                    />
                  )}
                  <span>
                    {v.name}
                    <small>{v.plate}</small>
                  </span>
                </Link>
                <div
                  className="workday-calendar-track"
                  style={{ gridTemplateColumns: `repeat(${count},minmax(0,1fr))` }}
                >
                  {days.map((d, index) => (
                    <span
                      key={d.key}
                      className="workday-calendar-cell"
                      style={{ gridColumn: index + 1 }}
                      data-selected={d.key === selected}
                    />
                  ))}
                  <div
                    className="workday-calendar-bookings"
                    style={{ gridTemplateColumns: `repeat(${count},minmax(0,1fr))` }}
                  >
                    {bookings.map((r) => (
                      <Link
                        key={r.id}
                        href={`/rentals/${r.id}`}
                        title={`${v.name}: ${r.clientName}`}
                        className="workday-rental-bar"
                        data-active={r.status === 'ACTIVE'}
                        style={{
                          gridColumn: `${r.placement!.start + 1} / span ${r.placement!.span}`,
                        }}
                      >
                        {r.clientName}
                      </Link>
                    ))}
                    {!bookings.length && (
                      <span
                        className="workday-calendar-empty"
                        style={{ gridColumn: `1 / span ${count}` }}
                      >
                        Нет аренд в этом периоде
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!fleet.length && <p className="p-5">Автомобили ещё не добавлены</p>}
        </div>
      </div>
      {fleet.length > 4 && (
        <button className="workday-show-all" type="button" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Свернуть список' : `Все автомобили (${fleet.length})`}
        </button>
      )}
    </section>
  );
}
