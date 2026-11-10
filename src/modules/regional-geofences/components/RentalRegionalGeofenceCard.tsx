'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { FiMap, FiSearch } from 'react-icons/fi';

import { Button } from '@/shared/ui';

import { saveRentalRegionalGeofence } from '../server/actions';
import type { RentalRegionalGeofenceView, RussianRegionOption } from '../types';

const STATE_LABELS: Record<RentalRegionalGeofenceView['state'], string> = {
  INSIDE: 'В разрешённой зоне',
  APPROACHING: 'Приближается к границе',
  OUTSIDE_PENDING: 'Проверяется возможный выезд',
  OUTSIDE: 'За пределами зоны',
  RETURNED: 'Вернулся в зону',
};

export function RentalRegionalGeofenceCard({
  rentalId,
  vehicleId,
  canEdit,
  regions,
  geofence,
}: {
  rentalId: string;
  vehicleId: string;
  canEdit: boolean;
  regions: readonly RussianRegionOption[];
  geofence: RentalRegionalGeofenceView | null;
}) {
  const [query, setQuery] = useState('');
  const [enabled, setEnabled] = useState(geofence?.enabled ?? true);
  const [selected, setSelected] = useState<string[]>(geofence?.regionCodes ?? []);
  const [warning, setWarning] = useState(geofence?.warningDistanceKm ?? 10);
  const [attention, setAttention] = useState(geofence?.attentionDistanceKm ?? 5);
  const [critical, setCritical] = useState(geofence?.criticalDistanceKm ?? 1);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const visibleRegions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru-RU');
    return normalized
      ? regions.filter(
          (region) =>
            region.name.toLocaleLowerCase('ru-RU').includes(normalized) ||
            region.code.toLocaleLowerCase('ru-RU').includes(normalized),
        )
      : regions;
  }, [query, regions]);
  const selectedRegions = regions.filter((region) => selected.includes(region.code));

  const toggle = (code: string) => {
    setSelected((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
    setMessage(null);
  };

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveRentalRegionalGeofence({
        rentalId,
        enabled,
        regionCodes: selected,
        warningDistanceKm: warning,
        attentionDistanceKm: attention,
        criticalDistanceKm: critical,
      });
      setMessage(result.ok ? `Геозона сохранена, версия ${result.version}.` : result.message);
    });
  };

  return (
    <section
      aria-label="Разрешённая территория"
      className="grid gap-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.06em] text-[var(--color-primary)] uppercase">
            GPS-контроль
          </p>
          <h2 className="mt-1 text-lg font-bold">Разрешённая территория</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Выберите регионы, внутри которых разрешено движение по этой аренде.
          </p>
        </div>
        <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
          {geofence ? STATE_LABELS[geofence.state] : 'Не настроено'}
        </span>
      </div>

      {selectedRegions.length ? (
        <div className="flex flex-wrap gap-2">
          {selectedRegions.map((region) => (
            <button
              key={region.code}
              type="button"
              disabled={!canEdit}
              onClick={() => toggle(region.code)}
              className="min-h-9 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary-soft)] px-3 text-xs font-semibold text-[var(--color-primary)] disabled:cursor-default"
            >
              {region.name}
              {canEdit ? ' ×' : ''}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] p-3 text-sm text-[var(--color-warning)]">
          Региональный контроль для этой аренды ещё не настроен.
        </p>
      )}

      {canEdit ? (
        <>
          <label className="flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="size-4 accent-[var(--color-primary)]"
            />
            Контроль включён
          </label>
          <label className="relative block">
            <FiSearch
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти регион"
              className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] pr-3 pl-10 text-sm"
            />
          </label>
          <div className="grid max-h-64 gap-1 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] p-2 sm:grid-cols-2 xl:grid-cols-3">
            {visibleRegions.map((region) => (
              <label
                key={region.code}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-[var(--color-elevated)]"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(region.code)}
                  onChange={() => toggle(region.code)}
                  className="size-4 accent-[var(--color-primary)]"
                />
                <span className="min-w-0 flex-1 truncate">{region.name}</span>
                {!region.automaticEnforcementAllowed ? (
                  <span title="Без автоматического объявления нарушения">⚠</span>
                ) : null}
              </label>
            ))}
          </div>
          <fieldset className="grid gap-3 sm:grid-cols-3">
            <legend className="sr-only">Пороги предупреждений</legend>
            {[
              ['Раннее, км', warning, setWarning],
              ['Внимание, км', attention, setAttention],
              ['Критическое, км', critical, setCritical],
            ].map(([label, value, setter]) => (
              <label key={String(label)} className="grid gap-1 text-xs font-semibold">
                {String(label)}
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={Number(value)}
                  onChange={(event) =>
                    (setter as (value: number) => void)(Number(event.target.value))
                  }
                  className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
                />
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={pending || selected.length === 0}>
              {pending ? 'Сохраняем…' : 'Сохранить геозону'}
            </Button>
            {message ? (
              <p aria-live="polite" className="text-sm">
                {message}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {geofence ? (
        <Link
          href={`/map?vehicleId=${encodeURIComponent(vehicleId)}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-elevated)] sm:justify-self-start"
        >
          <FiMap aria-hidden="true" /> Показать зону на онлайн-карте
        </Link>
      ) : null}
    </section>
  );
}
