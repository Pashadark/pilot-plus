'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FiFilter, FiPlus } from 'react-icons/fi';

import { markAllEventsReadAction, markEventReadAction } from '../actions';
import type { TimelineFilters } from '../server/queries';
import type { TimelineEventDto } from '../types';
import { useToast } from '@/shared/providers/ToastProvider';
import { BottomSheet, Button, Card, EmptyState, StatCard } from '@/shared/ui';

import { EventFilters } from './EventFilters';
import { EventTimelineCard } from './EventTimelineCard';
import { ManualEventDialog } from './ManualEventDialog';

function hasActiveFilters(filters: TimelineFilters) {
  return Boolean(
    filters.search ||
    filters.vehicleId ||
    filters.categories?.length ||
    filters.severities?.length ||
    (filters.read && filters.read !== 'all') ||
    filters.from ||
    filters.to,
  );
}

function loadMoreHref(filters: TimelineFilters, cursor: { before: string; beforeKey: string }) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.vehicleId) params.set('vehicle', filters.vehicleId);
  if (filters.categories?.length) params.set('category', filters.categories.join(','));
  if (filters.severities?.length) params.set('severity', filters.severities.join(','));
  if (filters.read) params.set('read', filters.read);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  params.set('limit', String(filters.limit ?? 30));
  params.set('before', cursor.before);
  params.set('beforeKey', cursor.beforeKey);
  return `/events?${params}`;
}

export function EventsWorkspace({
  events,
  nextCursor,
  stats,
  vehicles,
  filters,
}: {
  events: readonly TimelineEventDto[];
  nextCursor: { before: string; beforeKey: string } | null;
  stats: { total: number; danger: number; unread: number; vehicles: number };
  vehicles: readonly { id: string; label: string }[];
  filters: TimelineFilters;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [manualOpen, setManualOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [allPending, setAllPending] = useState(false);
  const markOne = async (key: string) => {
    setPendingKey(key);
    const state = await markEventReadAction(key);
    setPendingKey(null);
    showToast({ tone: state.status === 'success' ? 'success' : 'danger', title: state.message });
    if (state.status === 'success') router.refresh();
  };
  const markAll = async () => {
    setAllPending(true);
    const state = await markAllEventsReadAction(filters);
    setAllPending(false);
    showToast({ tone: state.status === 'success' ? 'success' : 'danger', title: state.message });
    if (state.status === 'success') router.refresh();
  };

  return (
    <>
      <section
        aria-label="Сводка истории событий"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard label="Всего за период" value={String(stats.total)} />
        <StatCard label="Критические" value={String(stats.danger)} />
        <StatCard label="Непрочитанные" value={String(stats.unread)} />
        <StatCard label="Автомобили с событиями" value={String(stats.vehicles)} />
      </section>
      <Card
        data-testid="events-desktop-filters"
        className="hidden p-4 md:block"
        aria-label="Фильтры истории событий"
      >
        <EventFilters filters={filters} vehicles={vehicles} />
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="secondary"
          className="md:hidden"
          onClick={() => setFiltersOpen(true)}
          leadingIcon={<FiFilter aria-hidden="true" />}
        >
          Открыть фильтры
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={markAll}
            loading={allPending}
            disabled={!events.length}
          >
            Отметить все прочитанными
          </Button>
          <Button
            onClick={() => setManualOpen(true)}
            leadingIcon={<FiPlus aria-hidden="true" />}
            disabled={!vehicles.length}
          >
            Добавить запись
          </Button>
        </div>
      </div>
      <section aria-label="Лента событий" className="grid gap-3">
        {events.length ? (
          events.map((event) => (
            <EventTimelineCard
              key={event.key}
              event={event}
              onMarkRead={markOne}
              pending={pendingKey === event.key}
            />
          ))
        ) : (
          <EmptyState
            title={
              hasActiveFilters(filters)
                ? 'По выбранным фильтрам событий нет'
                : 'История пока пуста.'
            }
            description={
              hasActiveFilters(filters)
                ? 'Измените условия поиска или сбросьте фильтры.'
                : 'Новые поездки, тревоги и ручные записи появятся здесь.'
            }
          />
        )}
        {nextCursor ? (
          <Link
            href={loadMoreHref(filters, nextCursor)}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border px-4 font-semibold text-[var(--color-primary)]"
          >
            Показать ещё
          </Link>
        ) : null}
      </section>
      <BottomSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Фильтры событий"
        description="Измените условия отображения истории."
        snap="intermediate"
        onSnapChange={() => undefined}
        className="overflow-y-auto"
      >
        <EventFilters
          filters={filters}
          vehicles={vehicles}
          onChanged={() => setFiltersOpen(false)}
        />
      </BottomSheet>
      <ManualEventDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        vehicles={vehicles}
        onSuccess={(message) => {
          showToast({ tone: 'success', title: message });
          router.refresh();
        }}
        onError={(message) => showToast({ tone: 'danger', title: message })}
      />
    </>
  );
}
