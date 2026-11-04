'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FiAlertTriangle, FiChevronLeft, FiChevronRight, FiUser } from 'react-icons/fi';
import { Modal } from '@/shared/ui';
import { WorkdayDetails } from './WorkdayDetails';
import type { DashboardFleetVehicle, DashboardWorkItemDto } from './overview-types';
import type { WorkdayCarouselItem } from './workday-carousel';

const money = (minor: string) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);

function operationLabel(item: DashboardWorkItemDto) {
  if (item.kind === 'DEPOSIT_RETURN') return 'Залог';
  if (item.kind === 'LOW_FUEL') return 'Заправить';
  return ['HANDOVER', 'DELIVERY'].includes(item.kind) ? 'Выдача' : 'Возврат';
}

function operationAction(item: DashboardWorkItemDto) {
  if (item.kind === 'DEPOSIT_RETURN') return 'Вернуть депозит';
  if (item.kind === 'LOW_FUEL') return 'Открыть автомобиль';
  return ['HANDOVER', 'DELIVERY'].includes(item.kind) ? 'Открыть аренду' : 'Проверить возврат';
}

export function WorkdayVehicleEvents({
  items,
  fleet,
}: {
  items: WorkdayCarouselItem[];
  fleet: DashboardFleetVehicle[];
}) {
  const [selected, setSelected] = useState<DashboardWorkItemDto | null>(null);
  const [edges, setEdges] = useState({ canBack: false, canForward: false });
  const viewportRef = useRef<HTMLDivElement>(null);

  const updateEdges = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setEdges({
      canBack: viewport.scrollLeft > 2,
      canForward: viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(viewport);
    viewport.addEventListener('scroll', updateEdges, { passive: true });
    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', updateEdges);
    };
  }, [items, updateEdges]);

  function scroll(direction: -1 | 1) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const firstCard = viewport.querySelector<HTMLElement>('[data-carousel-card]');
    const step = firstCard?.getBoundingClientRect().width ?? viewport.clientWidth;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    viewport.scrollBy({
      left: direction * (step + 14),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  return (
    <>
      <div
        className="workday-carousel"
        data-can-back={edges.canBack}
        data-can-forward={edges.canForward}
      >
        {edges.canBack && (
          <button
            type="button"
            className="workday-carousel-arrow workday-carousel-arrow--back"
            aria-label="Предыдущие карточки"
            onClick={() => scroll(-1)}
          >
            <FiChevronLeft aria-hidden="true" />
          </button>
        )}
        <div
          ref={viewportRef}
          className="workday-event-grid"
          role="region"
          aria-label="Оперативные события"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              scroll(-1);
            }
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              scroll(1);
            }
          }}
        >
          {items.map((carouselItem) => {
            if (carouselItem.type === 'attention') {
              const item = carouselItem.attention;
              return (
                <article
                  key={carouselItem.id}
                  className="workday-event-card workday-event-card--attention"
                  data-tone={item.tone}
                  data-carousel-card
                >
                  <div className="workday-event-top">
                    <FiAlertTriangle aria-hidden="true" />
                    <span className="workday-event-status" data-tone={item.tone}>
                      Важно
                    </span>
                  </div>
                  <div className="workday-attention-card-copy">
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                  <Link href={item.href} className="workday-event-action">
                    Проверить
                  </Link>
                </article>
              );
            }

            const item = carouselItem.operation;
            const vehicle = fleet.find(
              (v) =>
                item.details?.vehicleHref === `/vehicles/${v.id}` ||
                item.vehicleLabel === [v.name, v.plate].filter(Boolean).join(' · '),
            );
            const outgoing = ['HANDOVER', 'DELIVERY'].includes(item.kind);
            return (
              <article
                key={carouselItem.id}
                className="workday-event-card"
                data-tone={item.tone}
                data-carousel-card
              >
                <div className="workday-event-top">
                  <time dateTime={item.scheduledAt}>
                    {new Intl.DateTimeFormat('ru-RU', {
                      timeZone: 'Europe/Moscow',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(item.scheduledAt))}
                  </time>
                  <span
                    className="workday-event-status"
                    data-outgoing={outgoing}
                    data-tone={item.tone}
                  >
                    {operationLabel(item)}
                  </span>
                </div>
                <button
                  type="button"
                  className="workday-event-vehicle"
                  onClick={() => setSelected(item)}
                  aria-label={`Подробнее: ${item.vehicleLabel}`}
                >
                  {vehicle?.image ? (
                    <Image
                      src={vehicle.image.localPath}
                      alt={vehicle.image.alt}
                      width={180}
                      height={120}
                      unoptimized={!vehicle.image.localPath.startsWith('/vehicles/promo/')}
                    />
                  ) : (
                    <span className="workday-event-no-photo">Фото не добавлено</span>
                  )}
                  <span>
                    {vehicle?.name ?? item.vehicleLabel}
                    <small>{vehicle?.plate ?? item.contractNumber}</small>
                  </span>
                </button>
                <p className="workday-event-client">
                  <FiUser aria-hidden="true" />
                  {item.clientLabel ?? 'Клиент не указан'}
                </p>
                {item.kind === 'DEPOSIT_RETURN' && item.amountMinor && (
                  <strong className="workday-event-amount">{money(item.amountMinor)}</strong>
                )}
                <Link href={item.href} className="workday-event-action" data-primary={outgoing}>
                  {operationAction(item)}
                </Link>
              </article>
            );
          })}
        </div>
        {edges.canForward && (
          <button
            type="button"
            className="workday-carousel-arrow workday-carousel-arrow--forward"
            aria-label="Следующие карточки"
            onClick={() => scroll(1)}
          >
            <FiChevronRight aria-hidden="true" />
          </button>
        )}
      </div>
      {!items.length && (
        <div className="workday-empty">
          На выбранный день важных событий нет.
          <Link href="/rentals?booking=new">Создать бронирование</Link>
        </div>
      )}
      <Modal
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.title ?? 'Событие'}
      >
        {selected && <WorkdayDetails item={selected} />}
      </Modal>
    </>
  );
}
