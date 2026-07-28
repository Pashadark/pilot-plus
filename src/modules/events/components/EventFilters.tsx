'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FiSearch } from 'react-icons/fi';

import type { TimelineFilters } from '../server/queries';
import { Button, SearchInput, Select } from '@/shared/ui';

const categories = [
  ['MOVEMENT', 'Движение'],
  ['TRIP', 'Поездки'],
  ['STOP', 'Остановки'],
  ['ALERT', 'Тревоги'],
  ['FUEL', 'Топливо'],
  ['MAINTENANCE', 'ТО'],
  ['WASH', 'Мойки'],
  ['DEVICE', 'Устройства'],
  ['FIRMWARE', 'Прошивки'],
  ['MANUAL', 'Ручные записи'],
] as const;

const severities = [
  ['INFO', 'Информация'],
  ['WARNING', 'Предупреждение'],
  ['DANGER', 'Критическое'],
] as const;

export function EventFilters({
  filters,
  vehicles,
  onChanged,
}: {
  filters: TimelineFilters;
  vehicles: readonly { id: string; label: string }[];
  onChanged?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete('before');
    next.delete('beforeKey');
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    onChanged?.();
  };

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="grid min-w-0 gap-1.5 sm:col-span-2">
        <span className="text-sm font-medium">Поиск</span>
        <span className="relative">
          <FiSearch aria-hidden="true" className="absolute top-1/2 left-3 -translate-y-1/2" />
          <SearchInput
            aria-label="Поиск по истории"
            defaultValue={filters.search ?? ''}
            onChange={(event) => update('search', event.target.value)}
            placeholder="Автомобиль, заголовок или описание"
            className="pl-9"
          />
        </span>
      </label>
      <Select
        label="Автомобиль"
        value={filters.vehicleId ?? ''}
        onChange={(event) => update('vehicle', event.target.value)}
      >
        <option value="">Все автомобили</option>
        {vehicles.map((vehicle) => (
          <option key={vehicle.id} value={vehicle.id}>
            {vehicle.label}
          </option>
        ))}
      </Select>
      <Select
        label="Категория"
        value={filters.categories?.[0] ?? ''}
        onChange={(event) => update('category', event.target.value)}
      >
        <option value="">Все категории</option>
        {categories.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        label="Важность"
        value={filters.severities?.[0] ?? ''}
        onChange={(event) => update('severity', event.target.value)}
      >
        <option value="">Любая важность</option>
        {severities.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        label="Прочтение"
        value={filters.read ?? 'all'}
        onChange={(event) => update('read', event.target.value === 'all' ? '' : event.target.value)}
      >
        <option value="all">Все события</option>
        <option value="unread">Непрочитанные</option>
        <option value="read">Прочитанные</option>
      </Select>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">С даты</span>
        <input
          type="date"
          aria-label="С даты"
          value={filters.from?.slice(0, 10) ?? ''}
          onChange={(event) => update('from', event.target.value)}
          className="min-h-11 rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-3"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">По дату</span>
        <input
          type="date"
          aria-label="По дату"
          value={filters.to?.slice(0, 10) ?? ''}
          onChange={(event) => update('to', event.target.value)}
          className="min-h-11 rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-3"
        />
      </label>
      <Button
        variant="ghost"
        onClick={() => {
          router.replace(pathname, { scroll: false });
          onChanged?.();
        }}
      >
        Сбросить фильтры
      </Button>
    </div>
  );
}
