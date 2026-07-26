'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiDroplet,
  FiPlus,
  FiSearch,
} from 'react-icons/fi';

import { transitionWashAction } from '../actions';
import { washToCalendarEvent } from '../calendar';
import { calculateFleetCleanliness } from '../cleanliness';
import type { LatestCompletedWashDto, WashRecordDto } from '../server/queries';
import type { OperationActionState, WashKind, WashStatus } from '../types';
import type { VehicleOptionDto } from '@/modules/vehicles/types';
import { getPilotBusinessDateParts } from '@/shared/business-time';
import {
  canonicalizeOperationsCalendarQuery,
  OperationsCalendar,
  parseCalendarMonth,
  type OperationsCalendarView,
} from '@/shared/components/operations-calendar';
import { useToast } from '@/shared/providers/ToastProvider';
import { Badge, Button, Card, EmptyState, Modal, SearchInput, Select, Tabs } from '@/shared/ui';

import { WashForm } from './WashForm';
import {
  formatWashCost,
  formatWashDate,
  CleanlinessBadge,
  washKindLabels,
  WashRecordActions,
  WashRecordCard,
  WashStatusBadge,
  washStatusView,
} from './WashRecordCard';

type Filters = { query: string; status: '' | WashStatus; kind: '' | WashKind };

const initialFilters: Filters = { query: '', status: '', kind: '' };
const initialTransitionState: OperationActionState = { status: 'idle' };
const viewTabs = [
  { value: 'list', label: 'Список' },
  { value: 'calendar', label: 'Календарь' },
] as const;

function normalize(value: string) {
  return value.toLocaleLowerCase('ru-RU').trim();
}

function vehicleLabel(record: WashRecordDto) {
  return [record.vehicle.internalNumber, record.vehicle.model, record.vehicle.registrationNumber]
    .filter(Boolean)
    .join(' · ');
}

function matchesFilters(record: WashRecordDto, filters: Filters) {
  const query = normalize(filters.query);
  const searchable = normalize(
    [vehicleLabel(record), record.provider, record.notes, washKindLabels[record.kind]]
      .filter(Boolean)
      .join(' '),
  );
  return (
    (!query || searchable.includes(query)) &&
    (!filters.status || record.status === filters.status) &&
    (!filters.kind || record.kind === filters.kind)
  );
}

function sameDate(left: Date, right: Date) {
  const leftParts = getPilotBusinessDateParts(left);
  const rightParts = getPilotBusinessDateParts(right);
  return (
    leftParts.year === rightParts.year &&
    leftParts.month === rightParts.month &&
    leftParts.day === rightParts.day
  );
}

function sameMonth(left: Date, right: Date) {
  const leftParts = getPilotBusinessDateParts(left);
  const rightParts = getPilotBusinessDateParts(right);
  return leftParts.year === rightParts.year && leftParts.month === rightParts.month;
}

function StatCard({
  label,
  value,
  icon,
  testId,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  testId?: string;
}) {
  return (
    <Card className="min-w-0 p-4" data-testid={testId}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
          <strong className="text-2xl text-[var(--color-text)] tabular-nums">{value}</strong>
        </div>
      </div>
    </Card>
  );
}

export function WashWorkspace({
  records,
  vehicles,
  latestCompletedWashes,
}: {
  records: readonly WashRecordDto[];
  vehicles: readonly VehicleOptionDto[];
  latestCompletedWashes: readonly LatestCompletedWashDto[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(initialFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<{
    recordId: string;
    toStatus: WashStatus;
  } | null>(null);
  const [referenceTime] = useState(() => Date.now());
  const [transitionState, transitionFormAction, transitionPending] = useActionState(
    transitionWashAction,
    initialTransitionState,
  );
  const { showToast } = useToast();
  const visibleRecords = useMemo(
    () => records.filter((record) => matchesFilters(record, filters)),
    [filters, records],
  );
  const referenceDate = new Date(referenceTime);
  const fleetCleanliness = useMemo(
    () => calculateFleetCleanliness(vehicles, latestCompletedWashes, new Date(referenceTime)),
    [latestCompletedWashes, referenceTime, vehicles],
  );
  const cleanlinessByVehicleId = useMemo(
    () =>
      new Map(
        fleetCleanliness.vehicles.map((vehicle) => [vehicle.vehicleId, vehicle.status] as const),
      ),
    [fleetCleanliness],
  );
  const currentQuery = searchParams.toString();
  const canonicalQuery = useMemo(
    () =>
      canonicalizeOperationsCalendarQuery(
        new URLSearchParams(currentQuery),
        new Date(referenceTime),
      ),
    [currentQuery, referenceTime],
  );
  const { month, view } = canonicalQuery;
  const calendarEvents = useMemo(() => records.map(washToCalendarEvent), [records]);
  const recordsById = useMemo(
    () => new Map(records.map((record) => [record.id, record] as const)),
    [records],
  );
  const updateQuery = useCallback(
    (updates: Readonly<Record<string, string | null>>) => {
      const params = new URLSearchParams(currentQuery);
      Object.entries(updates).forEach(([name, value]) => {
        if (value === null) params.delete(name);
        else params.set(name, value);
      });
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [currentQuery, pathname, router],
  );
  const changeView = useCallback(
    (nextView: OperationsCalendarView) => {
      updateQuery(
        nextView === 'calendar' ? { view: nextView, month } : { view: nextView, month: null },
      );
    },
    [month, updateQuery],
  );
  const handleCreateSuccess = useCallback(
    (message: string) => {
      showToast({ tone: 'success', title: message });
      setFormOpen(false);
    },
    [showToast],
  );
  const registerTransitionIntent = useCallback(
    (transition: { recordId: string; toStatus: WashStatus }) => setPendingTransition(transition),
    [],
  );

  useEffect(() => {
    if (!canonicalQuery.changed) return;
    router.replace(`${pathname}?${canonicalQuery.query}`, { scroll: false });
  }, [canonicalQuery, pathname, router]);

  useEffect(() => {
    if (!transitionState.message || transitionState.status === 'idle') return;
    showToast({
      tone: transitionState.status === 'success' ? 'success' : 'danger',
      title: transitionState.message,
    });
  }, [showToast, transitionState]);

  return (
    <>
      <section aria-label="Сводка мойки" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Сегодня"
          value={
            records.filter(
              (record) =>
                (record.status === 'PLANNED' || record.status === 'IN_PROGRESS') &&
                sameDate(new Date(record.scheduledAt), referenceDate),
            ).length
          }
          icon={<FiCalendar aria-hidden="true" />}
          testId="wash-today-stat"
        />
        <StatCard
          label="В работе"
          value={records.filter((record) => record.status === 'IN_PROGRESS').length}
          icon={<FiDroplet aria-hidden="true" />}
        />
        <StatCard
          label="Завершено за месяц"
          value={
            records.filter(
              (record) =>
                record.status === 'COMPLETED' &&
                record.completedAt &&
                sameMonth(new Date(record.completedAt), referenceDate),
            ).length
          }
          icon={<FiCheckCircle aria-hidden="true" />}
        />
        <StatCard
          label="Требуют мойки"
          value={fleetCleanliness.needsWashCount}
          icon={<FiAlertCircle aria-hidden="true" />}
          testId="wash-needs-wash-stat"
        />
      </section>

      <Tabs items={viewTabs} value={view} onChange={changeView} aria-label="Представление мойки" />

      {view === 'list' ? (
        <section
          aria-label="Фильтры мойки"
          className="grid min-w-0 gap-3 rounded-[var(--radius-panel)] border bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] lg:grid-cols-[minmax(16rem,1fr)_minmax(10rem,0.35fr)_minmax(10rem,0.35fr)_auto] lg:items-end"
        >
          <label className="grid min-w-0 gap-1.5">
            <span className="text-sm font-medium">Поиск</span>
            <span className="relative block min-w-0">
              <FiSearch
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
              />
              <SearchInput
                value={filters.query}
                onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                aria-label="Поиск по мойке"
                placeholder="Автомобиль, подрядчик или примечание"
                className="min-w-0 pl-9"
              />
            </span>
          </label>
          <Select
            label="Статус"
            value={filters.status}
            onChange={(event) =>
              setFilters({ ...filters, status: event.target.value as Filters['status'] })
            }
          >
            <option value="">Все статусы</option>
            {Object.entries(washStatusView).map(([value, statusView]) => (
              <option key={value} value={value}>
                {statusView.label}
              </option>
            ))}
          </Select>
          <Select
            label="Вид мойки"
            value={filters.kind}
            onChange={(event) =>
              setFilters({ ...filters, kind: event.target.value as Filters['kind'] })
            }
          >
            <option value="">Все виды</option>
            {Object.entries(washKindLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Button
            variant="ghost"
            onClick={() => setFilters(initialFilters)}
            disabled={
              filters.query === initialFilters.query &&
              filters.status === initialFilters.status &&
              filters.kind === initialFilters.kind
            }
          >
            Сбросить
          </Button>
        </section>
      ) : null}

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <Badge tone="primary" size="lg">
          {view === 'list'
            ? `Показано ${visibleRecords.length} из ${records.length}`
            : `Событий в календаре: ${calendarEvents.length}`}
        </Badge>
        <Button
          onClick={() => setFormOpen(true)}
          leadingIcon={<FiPlus aria-hidden="true" />}
          disabled={!vehicles.length}
          title={vehicles.length ? undefined : 'Нет доступных автомобилей'}
        >
          Запланировать мойку
        </Button>
      </div>

      {view === 'list' ? (
        <>
          <div
            data-testid="wash-desktop-table"
            className="hidden min-w-0 overflow-x-auto rounded-[var(--radius-panel)] border bg-[var(--color-surface)] shadow-[var(--shadow-card)] md:block"
          >
            {visibleRecords.length ? (
              <table className="w-full min-w-[58rem] border-collapse text-left text-sm">
                <thead className="bg-[var(--color-elevated)] text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Автомобиль
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Тип мойки
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Дата
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Подрядчик
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Стоимость
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Статус
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Чистота
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {visibleRecords.map((record) => (
                    <tr key={record.id} data-testid="wash-record" className="align-top">
                      <th scope="row" className="max-w-56 px-4 py-4 font-semibold break-words">
                        {vehicleLabel(record)}
                      </th>
                      <td className="px-4 py-4 whitespace-nowrap">{washKindLabels[record.kind]}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {formatWashDate(record.scheduledAt)}
                      </td>
                      <td className="max-w-52 px-4 py-4 break-words">
                        {record.provider ?? 'Не указан'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap tabular-nums">
                        {formatWashCost(record.costMinor)}
                      </td>
                      <td className="px-4 py-4">
                        <WashStatusBadge status={record.status} />
                      </td>
                      <td className="px-4 py-4">
                        <CleanlinessBadge
                          status={cleanlinessByVehicleId.get(record.vehicleId) ?? 'NEEDS_WASH'}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <WashRecordActions
                          record={record}
                          formAction={transitionFormAction}
                          transitionPending={transitionPending}
                          pendingTransition={pendingTransition}
                          onTransitionIntent={registerTransitionIntent}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-4">
                <EmptyState title="Записи не найдены" description="Измените поиск или фильтры." />
              </div>
            )}
          </div>

          <div data-testid="wash-mobile-list" className="grid min-w-0 gap-3 md:hidden">
            {visibleRecords.length ? (
              visibleRecords.map((record) => (
                <WashRecordCard
                  key={record.id}
                  record={record}
                  formAction={transitionFormAction}
                  transitionPending={transitionPending}
                  pendingTransition={pendingTransition}
                  onTransitionIntent={registerTransitionIntent}
                  cleanliness={cleanlinessByVehicleId.get(record.vehicleId) ?? 'NEEDS_WASH'}
                  testId="wash-mobile-record"
                />
              ))
            ) : (
              <EmptyState title="Записи не найдены" description="Измените поиск или фильтры." />
            )}
          </div>
        </>
      ) : (
        <OperationsCalendar
          events={calendarEvents}
          month={month}
          onMonthChange={(nextMonth) => updateQuery({ month: nextMonth })}
          onToday={() => updateQuery({ month: parseCalendarMonth(null) })}
          renderEventDetails={(event) => {
            const record = recordsById.get(event.id);
            return record ? (
              <div className="min-w-0">
                <p className="text-[var(--color-text-secondary)]">Мойка или подрядчик</p>
                <p className="mt-1 font-semibold break-words text-[var(--color-text)]">
                  {record.provider ?? 'Не указан'}
                </p>
              </div>
            ) : undefined;
          }}
          renderEventStatus={(event) => {
            const record = recordsById.get(event.id);
            return record ? <WashStatusBadge status={record.status} /> : undefined;
          }}
          onEventAction={(event) => {
            const record = recordsById.get(event.id);
            return record ? (
              <WashRecordActions
                record={record}
                formAction={transitionFormAction}
                transitionPending={transitionPending}
                pendingTransition={pendingTransition}
                onTransitionIntent={registerTransitionIntent}
              />
            ) : null;
          }}
        />
      )}

      <Modal
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Запланировать мойку"
        description="Добавьте автомобиль в очередь на мойку вашей компании."
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
      >
        <WashForm
          vehicles={vehicles}
          onCancel={() => setFormOpen(false)}
          onSuccess={handleCreateSuccess}
        />
      </Modal>
    </>
  );
}
