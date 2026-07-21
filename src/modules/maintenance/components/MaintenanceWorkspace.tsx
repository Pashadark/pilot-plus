'use client';

import { useCallback, useMemo, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiClock, FiPlus, FiSearch, FiTool } from 'react-icons/fi';

import type { MaintenanceRecordDto } from '../server/queries';
import type { MaintenanceKind, MaintenanceStatus } from '../types';
import type { VehicleOptionDto } from '@/modules/vehicles/types';
import { Badge, Button, Card, EmptyState, Modal, SearchInput, Select } from '@/shared/ui';

import { MaintenanceForm } from './MaintenanceForm';
import {
  formatMaintenanceCost,
  formatMaintenanceDate,
  maintenanceKindLabels,
  MaintenanceRecordActions,
  MaintenanceRecordCard,
  maintenanceStatusView,
} from './MaintenanceRecordCard';

type Filters = { query: string; status: '' | MaintenanceStatus; kind: '' | MaintenanceKind };

const initialFilters: Filters = { query: '', status: '', kind: '' };

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

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="min-w-0 p-4">
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
  const [filters, setFilters] = useState(initialFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [referenceTime] = useState(() => Date.now());
  const visibleRecords = useMemo(
    () => records.filter((record) => matchesFilters(record, filters)),
    [filters, records],
  );
  const attentionRecords = records.filter((record) => {
    if (record.status === 'OVERDUE') return true;
    if (record.status !== 'PLANNED' || !record.scheduledAt) return false;
    const remaining = new Date(record.scheduledAt).getTime() - referenceTime;
    return remaining <= 7 * 24 * 60 * 60 * 1000;
  });
  const closeAfterSuccess = useCallback(() => setFormOpen(false), []);

  return (
    <>
      <section
        aria-label="Сводка технического обслуживания"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Всего записей"
          value={records.length}
          icon={<FiTool aria-hidden="true" />}
        />
        <StatCard
          label="Запланировано"
          value={records.filter((record) => record.status === 'PLANNED').length}
          icon={<FiClock aria-hidden="true" />}
        />
        <StatCard
          label="В работе"
          value={records.filter((record) => record.status === 'IN_PROGRESS').length}
          icon={<FiAlertTriangle aria-hidden="true" />}
        />
        <StatCard
          label="Завершено"
          value={records.filter((record) => record.status === 'COMPLETED').length}
          icon={<FiCheckCircle aria-hidden="true" />}
        />
      </section>

      {attentionRecords.length ? (
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
              {attentionRecords.length} работ просрочены или запланированы на ближайшие 7 дней.
            </p>
          </div>
        </section>
      ) : null}

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
          {Object.entries(maintenanceStatusView).map(([value, view]) => (
            <option key={value} value={value}>
              {view.label}
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

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <Badge tone="primary" size="lg">
          Показано {visibleRecords.length} из {records.length}
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
                  Статус
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {visibleRecords.map((record) => {
                const status = maintenanceStatusView[record.status];
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
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-4">
                      <MaintenanceRecordActions record={record} />
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
              action={<Button onClick={() => setFilters(initialFilters)}>Сбросить фильтры</Button>}
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
              testId="maintenance-mobile-record"
            />
          ))
        ) : (
          <EmptyState
            title="Работы не найдены"
            description="Измените условия поиска или сбросьте выбранные фильтры."
            action={<Button onClick={() => setFilters(initialFilters)}>Сбросить фильтры</Button>}
          />
        )}
      </div>

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
          onSuccess={closeAfterSuccess}
        />
      </Modal>
    </>
  );
}
