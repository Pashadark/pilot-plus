'use client';

import { useMemo } from 'react';

import { calculateRental, moscowLocalToUtc } from '@/modules/rentals/domain/calculate-rental';
import { resolveRentalMileagePolicy } from '@/modules/rentals/domain/mileage-policy';
import { Input, Select, Textarea } from '@/shared/ui';

import type { RentalConstructorState } from '../domain/types';

function rubles(minor: number) {
  return `${Math.round(minor / 100)
    .toLocaleString('ru-RU')
    .replaceAll('\u00a0', ' ')} ₽`;
}

function rubleInput(minor: number | undefined) {
  return minor === undefined ? '' : String(minor / 100);
}

function minorValue(value: string) {
  const rublesValue = Number(value.replace(',', '.'));
  return Number.isFinite(rublesValue) && rublesValue >= 0
    ? Math.round(rublesValue * 100)
    : undefined;
}

export function TermsSection({
  state,
  onChange,
}: {
  state: RentalConstructorState;
  onChange(patch: Partial<RentalConstructorState>): void;
}) {
  const calculation = useMemo(() => {
    if (!state.startsAt || !state.endsAt || state.dailyRateMinor === undefined) return null;
    try {
      return calculateRental({
        startsAt: moscowLocalToUtc(state.startsAt),
        endsAt: moscowLocalToUtc(state.endsAt),
        dailyMinor: state.dailyRateMinor,
        discountMinor: state.discountMinor ?? 0,
        serviceMinor: state.servicesMinor ?? 0,
      });
    } catch {
      return null;
    }
  }, [
    state.dailyRateMinor,
    state.discountMinor,
    state.endsAt,
    state.servicesMinor,
    state.startsAt,
  ]);
  const mileage = calculation
    ? resolveRentalMileagePolicy({
        agreementType: state.agreementType,
        billableDays: calculation.days,
        includedMileageKm: state.includedMileageKm,
      })
    : null;

  return (
    <section className="grid gap-5" aria-labelledby="constructor-terms-title">
      <div>
        <h2 id="constructor-terms-title" className="text-lg font-bold">
          Условия аренды
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Стоимость и лимит пробега рассчитываются по единым правилам СУПА ПРО.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Тип договора"
          value={state.agreementType}
          onChange={(event) =>
            onChange({ agreementType: event.currentTarget.value as RentalConstructorState['agreementType'] })
          }
        >
          <option value="STANDARD">Обычная аренда</option>
          <option value="LEASE_TO_OWN">Аренда с правом выкупа</option>
        </Select>
        <Input
          label="Суточный тариф, ₽"
          type="number"
          min="0"
          step="1"
          value={rubleInput(state.dailyRateMinor)}
          onChange={(event) => onChange({ dailyRateMinor: minorValue(event.currentTarget.value) })}
        />
        <Input
          label="Начало аренды"
          type="datetime-local"
          value={state.startsAt ?? ''}
          onChange={(event) => onChange({ startsAt: event.currentTarget.value })}
          required
        />
        <Input
          label="Возврат"
          type="datetime-local"
          value={state.endsAt ?? ''}
          onChange={(event) => onChange({ endsAt: event.currentTarget.value })}
          required
        />
        <Input
          label="Скидка, ₽"
          type="number"
          min="0"
          step="1"
          value={rubleInput(state.discountMinor)}
          onChange={(event) => onChange({ discountMinor: minorValue(event.currentTarget.value) })}
        />
        <Input
          label="Дополнительные услуги, ₽"
          type="number"
          min="0"
          step="1"
          value={rubleInput(state.servicesMinor)}
          onChange={(event) => onChange({ servicesMinor: minorValue(event.currentTarget.value) })}
        />
        <Input
          label="Залог, ₽"
          type="number"
          min="0"
          step="1"
          value={rubleInput(state.depositMinor)}
          onChange={(event) => onChange({ depositMinor: minorValue(event.currentTarget.value) })}
        />
        <Input
          label="Территория эксплуатации"
          value={state.territory ?? ''}
          onChange={(event) => onChange({ territory: event.currentTarget.value })}
          placeholder="Москва, Московская область"
        />
        <Input
          label="Место выдачи"
          value={state.pickupAddress ?? ''}
          onChange={(event) => onChange({ pickupAddress: event.currentTarget.value })}
        />
        <Input
          label="Место возврата"
          value={state.returnAddress ?? ''}
          onChange={(event) => onChange({ returnAddress: event.currentTarget.value })}
        />
      </div>
      <Textarea
        label="Особые условия"
        value={state.conditions ?? ''}
        onChange={(event) => onChange({ conditions: event.currentTarget.value })}
      />

      {calculation && mileage ? (
        <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-elevated)] p-4 sm:grid-cols-3">
          <div>
            <span className="text-xs text-[var(--color-text-secondary)]">Срок</span>
            <b className="mt-1 block">{calculation.days} суток</b>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-secondary)]">Итого</span>
            <b className="mt-1 block text-[var(--color-primary)]">
              {rubles(calculation.agreedTotalMinor)}
            </b>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-secondary)]">Пробег</span>
            <b className="mt-1 block">
              {mileage.totalLimitKm === null
                ? 'Без лимита для аренды с выкупом'
                : `${mileage.totalLimitKm} км на весь договор`}
            </b>
          </div>
        </div>
      ) : (
        <p className="rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] p-3 text-sm text-[var(--color-warning)]">
          Укажите корректные даты и тариф для расчёта.
        </p>
      )}
    </section>
  );
}
