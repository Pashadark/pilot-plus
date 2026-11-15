'use client';

import { FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

import { Input, Select, Textarea } from '@/shared/ui';

import type { RentalConstructorState } from '../domain/types';

function integer(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function PaymentToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 text-sm font-semibold">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="size-5 accent-[var(--color-primary)]"
      />
      {label}
    </label>
  );
}

export function HandoverSection({
  state,
  onChange,
}: {
  state: RentalConstructorState;
  onChange(patch: Partial<RentalConstructorState>): void;
}) {
  return (
    <section className="grid gap-5" aria-labelledby="constructor-handover-title">
      <div>
        <h2 id="constructor-handover-title" className="text-lg font-bold">
          Выдача автомобиля
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Зафиксируйте показатели автомобиля и только фактически полученные платежи.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Одометр при выдаче, км"
          type="number"
          min="0"
          step="1"
          required
          value={state.startMileageKm ?? ''}
          onChange={(event) => onChange({ startMileageKm: integer(event.currentTarget.value) })}
        />
        <Input
          label="Топливо при выдаче, %"
          type="number"
          min="0"
          max="100"
          step="1"
          required
          value={state.startFuelPercent ?? ''}
          onChange={(event) => onChange({ startFuelPercent: integer(event.currentTarget.value) })}
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
        label="Допущенные водители"
        value={state.allowedDrivers ?? ''}
        onChange={(event) => onChange({ allowedDrivers: event.currentTarget.value })}
      />
      <Textarea
        label="Состояние и замечания при выдаче"
        value={state.conditions ?? ''}
        onChange={(event) => onChange({ conditions: event.currentTarget.value })}
      />

      <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
        <div className="flex items-start gap-2">
          <FiCheckCircle className="mt-0.5 shrink-0 text-[var(--color-success)]" aria-hidden />
          <div>
            <h3 className="font-semibold">Полученные платежи</h3>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Не отмечайте будущую или обещанную оплату — запись сразу попадёт в расчёты договора.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <PaymentToggle
            label="Аренда оплачена"
            checked={state.rentReceived ?? false}
            onChange={(rentReceived) => onChange({ rentReceived })}
          />
          <PaymentToggle
            label="Залог получен"
            checked={state.depositReceived ?? false}
            onChange={(depositReceived) => onChange({ depositReceived })}
          />
        </div>
        {(state.rentReceived || state.depositReceived) && (
          <Select
            label="Способ оплаты"
            value={state.paymentMethod ?? 'OTHER'}
            onChange={(event) =>
              onChange({
                paymentMethod: event.currentTarget
                  .value as RentalConstructorState['paymentMethod'],
              })
            }
          >
            <option value="CASH">Наличные</option>
            <option value="CARD">Карта</option>
            <option value="TRANSFER">Перевод</option>
            <option value="OTHER">Другое</option>
          </Select>
        )}
      </div>

      <p className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] p-3 text-xs text-[var(--color-warning)]">
        <FiAlertCircle className="mt-0.5 shrink-0" aria-hidden />
        После подтверждения договор займёт автомобиль на выбранный период. Повторное нажатие не
        создаст дубли платежей или документов.
      </p>
    </section>
  );
}
