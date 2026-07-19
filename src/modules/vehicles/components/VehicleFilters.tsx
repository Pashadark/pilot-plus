import { FiRotateCcw, FiSearch } from 'react-icons/fi';

import type { VehicleFilters as VehicleFiltersValue } from '../filter';
import type { VehicleCardDto } from '../types';
import { Button, SearchInput, Select } from '@/shared/ui';

export function VehicleFilters({
  filters,
  vehicles,
  onChange,
  onReset,
}: {
  filters: VehicleFiltersValue;
  vehicles: readonly VehicleCardDto[];
  onChange: (filters: VehicleFiltersValue) => void;
  onReset: () => void;
}) {
  const cities = [...new Set(vehicles.map((vehicle) => vehicle.city))].sort((a, b) =>
    a.localeCompare(b, 'ru-RU'),
  );
  const seats = [...new Set(vehicles.map((vehicle) => vehicle.seats))].sort((a, b) => a - b);

  return (
    <div className="grid gap-3 rounded-[var(--radius-panel)] border bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] lg:grid-cols-[minmax(16rem,1fr)_repeat(4,minmax(8rem,0.45fr))_auto] lg:items-end">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Поиск</span>
        <span className="relative block">
          <FiSearch
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          />
          <SearchInput
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
            aria-label="Поиск автомобилей"
            placeholder="Модель, город, офис или номер"
            className="pl-9"
          />
        </span>
      </label>
      <Select
        label="Город"
        value={filters.city}
        onChange={(event) => onChange({ ...filters, city: event.target.value })}
      >
        <option value="">Все города</option>
        {cities.map((city) => (
          <option key={city}>{city}</option>
        ))}
      </Select>
      <Select
        label="Топливо"
        value={filters.fuelType}
        onChange={(event) =>
          onChange({
            ...filters,
            fuelType: event.target.value as VehicleFiltersValue['fuelType'],
          })
        }
      >
        <option value="">Любое</option>
        <option value="PETROL">Бензин</option>
        <option value="DIESEL">Дизель</option>
        <option value="ELECTRIC">Электричество</option>
        <option value="HYBRID">Гибрид</option>
        <option value="OTHER">Другое</option>
      </Select>
      <Select
        label="Статус"
        value={filters.status}
        onChange={(event) =>
          onChange({ ...filters, status: event.target.value as VehicleFiltersValue['status'] })
        }
      >
        <option value="">Все статусы</option>
        <option value="MOVING">В движении</option>
        <option value="IDLE">Стоит</option>
        <option value="OFFLINE">Не на связи</option>
        <option value="MAINTENANCE">Обслуживание</option>
        <option value="UNKNOWN">Нет телеметрии</option>
      </Select>
      <Select
        label="Мест"
        value={filters.seats}
        onChange={(event) => onChange({ ...filters, seats: event.target.value })}
      >
        <option value="">Любое</option>
        {seats.map((count) => (
          <option key={count} value={count}>
            {count}
          </option>
        ))}
      </Select>
      <Button
        variant="ghost"
        size="sm"
        leadingIcon={<FiRotateCcw aria-hidden="true" />}
        onClick={onReset}
      >
        Сбросить
      </Button>
    </div>
  );
}
