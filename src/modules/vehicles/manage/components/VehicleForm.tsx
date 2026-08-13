'use client';

import { useActionState, useEffect } from 'react';

import { createVehicleAction, type VehicleActionState } from '../actions';
import { Button, Input, Select, Switch } from '@/shared/ui';
import { useToast } from '@/shared/providers/ToastProvider';

const initialState: VehicleActionState = { ok: false, code: 'IDLE', message: '' };

export type ManageableCompany = { id: string; label: string };

export function VehicleForm({ companies }: { companies: readonly ManageableCompany[] }) {
  const [state, action, pending] = useActionState(createVehicleAction, initialState);
  const { showToast } = useToast();
  useEffect(() => {
    if (state.ok) {
      showToast({ tone: 'success', title: 'Автомобиль сохранён' });
      return;
    }
    if (!state.message) return;
    showToast({
      tone: 'danger',
      title: 'Не удалось сохранить автомобиль',
      description: state.message,
    });
  }, [showToast, state]);
  const fieldError = (name: string) => (!state.ok ? state.fieldErrors?.[name]?.[0] : undefined);

  return (
    <form action={action} className="grid min-w-0 gap-5">
      <section className="grid gap-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-2 sm:p-6">
        {companies.length === 1 ? (
          <input type="hidden" name="companyId" value={companies[0]?.id} />
        ) : (
          <Select name="companyId" label="Компания" required error={fieldError('companyId')}>
            <option value="">Выберите компанию</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.label}
              </option>
            ))}
          </Select>
        )}
        <Input
          name="internalNumber"
          label="Внутренний номер"
          required
          error={fieldError('internalNumber')}
        />
        <Input
          name="registrationNumber"
          label="Государственный номер"
          required
          error={fieldError('registrationNumber')}
        />
        <Input name="make" label="Марка" required error={fieldError('make')} />
        <Input name="model" label="Модель" required error={fieldError('model')} />
        <Input
          name="year"
          type="number"
          min="1950"
          label="Год выпуска"
          required
          error={fieldError('year')}
        />
        <Input name="vin" label="VIN" error={fieldError('vin')} />
        <Input name="city" label="Город" required error={fieldError('city')} />
        <Input
          name="dailyPriceRubles"
          inputMode="decimal"
          label="Суточный тариф, ₽"
          required
          error={fieldError('dailyPriceRubles')}
        />
        <Select
          name="transmission"
          label="Коробка передач"
          required
          defaultValue="АКПП"
          error={fieldError('transmission')}
        >
          <option>АКПП</option>
          <option>МКПП</option>
        </Select>
        <Select
          name="fuelType"
          label="Топливо"
          required
          defaultValue="PETROL"
          error={fieldError('fuelType')}
        >
          <option value="PETROL">Бензин</option>
          <option value="DIESEL">Дизель</option>
          <option value="ELECTRIC">Электро</option>
          <option value="HYBRID">Гибрид</option>
          <option value="OTHER">Другое</option>
        </Select>
        <Input
          name="seats"
          type="number"
          min="1"
          defaultValue="5"
          label="Количество мест"
          required
          error={fieldError('seats')}
        />
        <Select
          name="status"
          label="Статус"
          required
          defaultValue="UNKNOWN"
          error={fieldError('status')}
        >
          <option value="UNKNOWN">Неизвестен</option>
          <option value="IDLE">Свободен</option>
          <option value="MAINTENANCE">На обслуживании</option>
          <option value="OFFLINE">Нет связи</option>
          <option value="MOVING">В пути</option>
        </Select>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium sm:col-span-2">
          <Switch name="isRentalReady" value="true" /> Готов к аренде
        </label>
      </section>
      {!state.ok && state.message && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          Сохранить автомобиль
        </Button>
      </div>
    </form>
  );
}
