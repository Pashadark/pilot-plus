'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { FiActivity, FiCloudOff, FiCpu, FiPlus, FiSearch, FiUploadCloud } from 'react-icons/fi';

import { DEVICE_STATUS_META } from '../status';
import type {
  DeviceListItem,
  DevicePowerSource,
  DeviceStatus,
  FirmwareReleaseItem,
} from '../types';
import { useToast } from '@/shared/providers/ToastProvider';
import { Badge, Button, Card, EmptyState, Modal, SearchInput, Select } from '@/shared/ui';

import { DeviceCard } from './DeviceCard';
import { DeviceForm } from './DeviceForm';
import { DeviceTable } from './DeviceTable';

type DeviceFilters = {
  query: string;
  status: '' | DeviceStatus;
  power: '' | DevicePowerSource;
  update: '' | 'available' | 'current' | `version:${string}`;
  binding: '' | 'bound' | 'free';
};

type DevicesWorkspaceProps = {
  devices: readonly DeviceListItem[];
  firmwareReleases: readonly FirmwareReleaseItem[];
  availableVehicles: readonly { id: string; label: string }[];
  summary: { total: number; online: number; offline: number; updateAvailable: number };
};

const initialFilters: DeviceFilters = { query: '', status: '', power: '', update: '', binding: '' };

function parseFilters(searchParams: URLSearchParams): DeviceFilters {
  const status = searchParams.get('status');
  const power = searchParams.get('power');
  const update = searchParams.get('update');
  const binding = searchParams.get('binding');
  return {
    query: searchParams.get('q') ?? '',
    status: status && status in DEVICE_STATUS_META ? (status as DeviceStatus) : '',
    power: power === 'VEHICLE' || power === 'BATTERY' ? power : '',
    update:
      update === 'available' || update === 'current' || update?.startsWith('version:')
        ? (update as DeviceFilters['update'])
        : '',
    binding: binding === 'bound' || binding === 'free' ? binding : '',
  };
}

function normalize(value: string) {
  return value.toLocaleLowerCase('ru-RU').trim();
}

function matchesFilters(device: DeviceListItem, filters: DeviceFilters) {
  const query = normalize(filters.query);
  const searchable = normalize(
    [
      device.name,
      device.serialNumber,
      device.imei,
      device.vehicle?.label,
      device.vehicle?.registrationNumber,
    ]
      .filter(Boolean)
      .join(' '),
  );
  const hasMatchingFirmware = filters.update.startsWith('version:')
    ? device.firmwareVersion === filters.update.slice('version:'.length)
    : true;
  return (
    (!query || searchable.includes(query)) &&
    (!filters.status || device.effectiveStatus === filters.status) &&
    (!filters.power || device.powerSource === filters.power) &&
    (!filters.update ||
      (filters.update === 'available' && device.updateAvailable) ||
      (filters.update === 'current' && !device.updateAvailable) ||
      hasMatchingFirmware) &&
    (!filters.binding ||
      (filters.binding === 'bound' && Boolean(device.vehicle)) ||
      (filters.binding === 'free' && !device.vehicle))
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

export function DevicesWorkspace({
  devices,
  firmwareReleases,
  availableVehicles,
  summary,
}: DevicesWorkspaceProps) {
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();

  return (
    <DevicesWorkspaceContent
      key={currentQuery}
      devices={devices}
      firmwareReleases={firmwareReleases}
      availableVehicles={availableVehicles}
      summary={summary}
      currentQuery={currentQuery}
    />
  );
}

function DevicesWorkspaceContent({
  devices,
  firmwareReleases,
  availableVehicles,
  summary,
  currentQuery,
}: DevicesWorkspaceProps & { currentQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState(() => parseFilters(new URLSearchParams(currentQuery)));
  const [formOpen, setFormOpen] = useState(false);
  const { showToast } = useToast();
  const visibleDevices = useMemo(
    () => devices.filter((device) => matchesFilters(device, filters)),
    [devices, filters],
  );
  const updateFilters = useCallback(
    (updates: Partial<DeviceFilters>) => {
      setFilters((previous) => ({ ...previous, ...updates }));
      const params = new URLSearchParams(currentQuery);
      Object.entries(updates).forEach(([key, value]) => {
        const name = key === 'query' ? 'q' : key;
        if (!value) params.delete(name);
        else params.set(name, value);
      });
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [currentQuery, pathname, router],
  );

  const clearFilters = useCallback(() => updateFilters(initialFilters), [updateFilters]);
  const handleCreateSuccess = useCallback(
    (message: string) => {
      showToast({ tone: 'success', title: message });
      setFormOpen(false);
      router.refresh();
    },
    [router, showToast],
  );
  const isFiltered = Object.values(filters).some(Boolean);

  return (
    <>
      <section aria-label="Сводка устройств" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Всего устройств"
          value={summary.total}
          icon={<FiCpu aria-hidden="true" />}
          testId="devices-total-stat"
        />
        <StatCard
          label="Онлайн"
          value={summary.online}
          icon={<FiActivity aria-hidden="true" />}
          testId="devices-online-stat"
        />
        <StatCard
          label="Офлайн"
          value={summary.offline}
          icon={<FiCloudOff aria-hidden="true" />}
          testId="devices-offline-stat"
        />
        <StatCard
          label="Требуют обновления"
          value={summary.updateAvailable}
          icon={<FiUploadCloud aria-hidden="true" />}
          testId="devices-update-stat"
        />
      </section>

      <section
        aria-label="Фильтры устройств"
        className="grid min-w-0 gap-3 rounded-[var(--radius-panel)] border bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] xl:grid-cols-[minmax(16rem,1fr)_repeat(4,minmax(9rem,0.35fr))_auto] xl:items-end"
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
              onChange={(event) => updateFilters({ query: event.target.value })}
              aria-label="Поиск устройств"
              placeholder="Имя, серийный номер, IMEI или автомобиль"
              className="min-w-0 pl-9"
            />
          </span>
        </label>
        <Select
          label="Статус"
          value={filters.status}
          onChange={(event) =>
            updateFilters({ status: event.target.value as DeviceFilters['status'] })
          }
        >
          <option value="">Все статусы</option>
          {Object.entries(DEVICE_STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
        <Select
          label="Питание"
          value={filters.power}
          onChange={(event) =>
            updateFilters({ power: event.target.value as DeviceFilters['power'] })
          }
        >
          <option value="">Все источники</option>
          <option value="VEHICLE">От автомобиля</option>
          <option value="BATTERY">Аккумулятор</option>
        </Select>
        <Select
          label="Обновление"
          value={filters.update}
          onChange={(event) =>
            updateFilters({ update: event.target.value as DeviceFilters['update'] })
          }
        >
          <option value="">Все версии</option>
          <option value="available">Доступно обновление</option>
          <option value="current">Актуальная версия</option>
          {firmwareReleases.map((release) => (
            <option key={release.id} value={`version:${release.version}`}>
              Версия {release.version}
            </option>
          ))}
        </Select>
        <Select
          label="Привязка"
          value={filters.binding}
          onChange={(event) =>
            updateFilters({ binding: event.target.value as DeviceFilters['binding'] })
          }
        >
          <option value="">Все устройства</option>
          <option value="bound">Привязано к автомобилю</option>
          <option value="free">Свободные устройства</option>
        </Select>
        <Button variant="ghost" onClick={clearFilters} disabled={!isFiltered}>
          Сбросить
        </Button>
      </section>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <Badge tone="primary" size="lg">
          Показано {visibleDevices.length} из {devices.length}
        </Badge>
        <Button onClick={() => setFormOpen(true)} leadingIcon={<FiPlus aria-hidden="true" />}>
          Добавить устройство
        </Button>
      </div>

      {devices.length === 0 ? (
        <EmptyState
          title="В компании пока нет устройств"
          description="Добавьте первый трекер Pilot Connect, чтобы видеть состояние связи и автомобиля."
          action={
            <Button onClick={() => setFormOpen(true)} leadingIcon={<FiPlus aria-hidden="true" />}>
              Добавить устройство
            </Button>
          }
        />
      ) : (
        <>
          <div
            data-testid="devices-table"
            className="hidden min-w-0 overflow-x-auto rounded-[var(--radius-panel)] border bg-[var(--color-surface)] shadow-[var(--shadow-card)] md:block"
          >
            <DeviceTable
              devices={visibleDevices}
              firmwareReleases={firmwareReleases}
              availableVehicles={availableVehicles}
            />
          </div>
          <div data-testid="devices-mobile-list" className="grid min-w-0 gap-3 md:hidden">
            {visibleDevices.length ? (
              visibleDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  firmwareReleases={firmwareReleases}
                  availableVehicles={availableVehicles}
                />
              ))
            ) : (
              <EmptyState
                title="Устройства не найдены"
                description="Измените условия поиска или сбросьте выбранные фильтры."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Сбросить фильтры
                  </Button>
                }
              />
            )}
          </div>
        </>
      )}

      <Modal
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Добавить устройство"
        description="Укажите данные нового трекера Pilot Connect."
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
      >
        <DeviceForm
          firmwareReleases={firmwareReleases}
          vehicles={availableVehicles}
          onCancel={() => setFormOpen(false)}
          onSuccess={handleCreateSuccess}
        />
      </Modal>
    </>
  );
}
