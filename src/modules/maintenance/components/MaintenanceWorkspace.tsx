'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useCallback, useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiClock, FiPlus, FiSearch, FiTool } from 'react-icons/fi';

import { transitionMaintenanceAction } from '../actions';
import { maintenanceToCalendarEvent } from '../calendar';
import { calculateMaintenanceSummary } from '../effective-status';
import type { MaintenanceRecordDto } from '../server/queries';
import type { MaintenanceKind, MaintenanceStatus, OperationActionState } from '../types';
import type { VehicleOptionDto } from '@/modules/vehicles/types';
import {
  OperationsCalendar,
  parseCalendarMonth,
  type OperationsCalendarEvent,
} from '@/shared/components/operations-calendar';
import { useToast } from '@/shared/providers/ToastProvider';
import { Badge, Button, Card, EmptyState, Modal, SearchInput, Select, Tabs } from '@/shared/ui';

import { MaintenanceForm } from './MaintenanceForm';
import {
  formatMaintenanceCost,
  formatMaintenanceDate,
  maintenanceKindLabels,
  MaintenanceRecordActions,
  MaintenanceRecordCard,
  MaintenanceOdometerView,
  MaintenanceStatusBadge,
  maintenanceStatusView,
} from './MaintenanceRecordCard';

type Filters = { query: string; status: '' | MaintenanceStatus; kind: '' | MaintenanceKind };
type WorkspaceView = 'list' | 'calendar';

const initialFilters: Filters = { query: '', status: '', kind: '' };
const initialTransitionState: OperationActionState = { status: 'idle' };
const viewTabs = [
  { value: 'list', label: 'Список' },
  { value: 'calendar', label: 'Календарь' },
] as const;

function normalize(value: string) {
  return value.toLocaleLowerCase('ru-RU').trim();
}

function vehicleLabel(record: MaintenanceRecordDto) {
  return [record.vehicle.internalNumber, record.vehicle.model, record.vehicle.registrationNumber]
    .filter(Boolean)
    .join(' · ');
}

function matchesFilters(record: MaintenanceRecordDto, filters: Filters) {
  const query = normalize(filters.query);
  const searchable = normalize(
    [record.title, vehicleLabel(record), record.provider, record.notes].filter(Boolean).join(' '),
  );
  return (
    (!query || searchable.includes(query)) &&
    (!filters.status || record.status === filters.status) &&
    (!filters.kind || record.kind === filters.kind)
  );
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
  testId: string;
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

export function MaintenanceWorkspace({
  records,
  vehicles,
}: {
  records: readonly MaintenanceRecordDto[];
  vehicles: readonly VehicleOptionDto[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(initialFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [referenceTime] = useState(() => Date.now());
  const [transitionState, transitionFormAction, transitionPending] = useActionState(
    transitionMaintenanceAction,
    initialTransitionState,
  );
  const { showToast } = useToast();
  const visibleRecords = useMemo(
    () => records.filter((record) => matchesFilters(record, filters)),
    [filters, records],
  );
  const summary = useMemo(
    () => calculateMaintenanceSummary(records, new Date(referenceTime)),
    [records, referenceTime],
  );
  const attentionCount = summary.dueSoon + summary.overdue;
  const view: WorkspaceView = searchParams.get('view') === 'calendar' ? 'calendar' : 'list';
  const month = parseCalendarMonth(searchParams.get('month'), new Date(referenceTime));
  const calendarEvents = useMemo(
    () =>
      records
        .map(maintenanceToCalendarEvent)
        .filter((event): event is OperationsCalendarEvent => event !== null),
    [records],
  );
  const recordsById = useMemo(
    () => new Map(records.map((record) => [record.id, record] as const)),
    [records],
  );
  const updateQuery = useCallback(
    (updates: Readonly<Record<string, string>>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([name, value]) => params.set(name, value));
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );
  const changeView = useCallback(
    (nextView: WorkspaceView) => {
      updateQuery(nextView === 'calendar' ? { view: nextView, month } : { view: nextView });
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

  useEffect(() => {
    if (!transitionState.message || transitionState.status === 'idle') return;
    showToast({
      tone: transitionState.status === 'success' ? 'success' : 'danger',
      title: transitionState.message,
    });
  }, [showToast, transitionState]);

  return (
    <>
      <section
        aria-label="Сводка технического обслуживания"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Запланировано"
          value={summary.planned}
          icon={<FiTool aria-hidden="true" />}
          testId="maintenance-planned-stat"
        />
        <StatCard
          label="Скоро"
          value={summary.dueSoon}
          icon={<FiClock aria-hidden="true" />}
          testId="maintenance-due-soon-stat"
        />
        <StatCard
          label="Просрочено"
          value={summary.overdue}
          icon={<FiAlertTriangle aria-hidden="true" />}
          testId="maintenance-overdue-stat"
        />
        <StatCard
          label="Завершено за месяц"
          value={summary.completedThisMonth}
          icon={<FiCheckCircle aria-hidden="true" />}
          testId="maintenance-completed-month-stat"
        />
      </section>

      {attentionCount ? (
        <section
          role="status"
          className="flex min-w-0 flex-wrap items-start gap-3 rounded-[var(--radius-panel)] border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-4"
        >
          <FiAlertTriangle
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--color-warning)]"
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-[var(--color-text)]">Требуют внимания</h2>
            <p className="text-sm break-words text-[var(--color-text-secondary)]">
              {attentionCount} работ просрочены или запланированы на ближайшие 7 дней.
            </p>
          </div>
        </section>
      ) : null}

      <Tabs
        items={viewTabs}
        value={view}
        onChange={changeView}
        aria-label="Представление технического обслуживания"
      />

      {view === 'list' ? (
        <section
          aria-label="Фильтры технического обслуживания"
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
                aria-label="Поиск по обслуживанию"
                placeholder="Работа, автомобиль или сервис"
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
            {Object.entries(maintenanceStatusView).map(([value, statusView]) => (
              <option key={value} value={value}>
                {statusView.label}
              </option>
            ))}
          </Select>
          <Select
            label="Вид ТО"
            value={filters.kind}
            onChange={(event) =>
              setFilters({ ...filters, kind: event.target.value as Filters['kind'] })
            }
          >
            <option value="">Все виды</option>
            {Object.entries(maintenanceKindLabels).map(([value, label]) => (
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
          Запланировать ТО
        </Button>
      </div>

      {view === 'list' ? (
        <>
          <div
            data-testid="maintenance-desktop-table"
            className="hidden min-w-0 overflow-x-auto rounded-[var(--radius-panel)] border bg-[var(--color-surface)] shadow-[var(--shadow-card)] md:block"
          >
            {visibleRecords.length ? (
              <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
                <thead className="bg-[var(--color-elevated)] text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Работа
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Автомобиль
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Дата
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Стоимость
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Пробег
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Статус
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {visibleRecords.map((record) => {
                    return (
                      <tr key={record.id} data-testid="maintenance-record" className="align-top">
                        <th scope="row" className="max-w-64 px-4 py-4 font-semibold">
                          <span className="block break-words">{record.title}</span>
                          <span className="mt-1 block text-xs font-normal text-[var(--color-text-secondary)]">
                            {maintenanceKindLabels[record.kind]}
                          </span>
                        </th>
                        <td className="max-w-56 px-4 py-4 break-words">{vehicleLabel(record)}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {formatMaintenanceDate(record.scheduledAt)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap tabular-nums">
                          {formatMaintenanceCost(record.costMinor)}
                        </td>
                        <td className="px-4 py-4">
                          <MaintenanceOdometerView record={record} />
                        </td>
                        <td className="px-4 py-4">
                          <MaintenanceStatusBadge status={record.status} />
                        </td>
                        <td className="px-4 py-4">
                          <MaintenanceRecordActions
                            record={record}
                            formAction={transitionFormAction}
                            pending={transitionPending}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-4">
                <EmptyState
                  title="Работы не найдены"
                  description="Измените условия поиска или сбросьте выбранные фильтры."
                  action={
                    <Button onClick={() => setFilters(initialFilters)}>Сбросить фильтры</Button>
                  }
                />
              </div>
            )}
          </div>

          <div data-testid="maintenance-mobile-list" className="grid min-w-0 gap-3 md:hidden">
            {visibleRecords.length ? (
              visibleRecords.map((record) => (
                <MaintenanceRecordCard
                  key={record.id}
                  record={record}
                  formAction={transitionFormAction}
                  pending={transitionPending}
                  testId="maintenance-mobile-record"
                />
              ))
            ) : (
              <EmptyState
                title="Работы не найдены"
                description="Измените условия поиска или сбросьте выбранные фильтры."
                action={
                  <Button onClick={() => setFilters(initialFilters)}>Сбросить фильтры</Button>
                }
              />
            )}
          </div>
        </>
      ) : (
        <OperationsCalendar
          events={calendarEvents}
          month={month}
          onMonthChange={(nextMonth) => updateQuery({ month: nextMonth })}
          onToday={() => updateQuery({ month: parseCalendarMonth(null) })}
          onEventAction={(event) => {
            const record = recordsById.get(event.id);
            return record ? (
              <MaintenanceRecordActions
                record={record}
                formAction={transitionFormAction}
                pending={transitionPending}
              />
            ) : null;
          }}
        />
      )}

      <Modal
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Запланировать ТО"
        description="Создайте работу для автомобиля вашей компании."
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
      >
        <MaintenanceForm
          vehicles={vehicles}
          onCancel={() => setFormOpen(false)}
          onSuccess={handleCreateSuccess}
        />
      </Modal>
    </>
  );
}
