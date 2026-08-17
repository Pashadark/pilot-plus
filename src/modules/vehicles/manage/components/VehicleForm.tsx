'use client';

import { useActionState, useEffect } from 'react';

import { createVehicleAction, updateVehicleAction, type VehicleActionState } from '../actions';
import { Button, Input, Select, Switch } from '@/shared/ui';
import { useToast } from '@/shared/providers/ToastProvider';

const initialState: VehicleActionState = { ok: false, code: 'IDLE', message: '' };

export type ManageableCompany = { id: string; label: string; canArchive: boolean };
export type EditableVehicle = {
  id: string;
  companyId: string;
  internalNumber: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  vin: string | null;
  city: string;
  dailyPriceRubles: string;
  transmission: string;
  fuelType: 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'OTHER';
  seats: number;
  status: 'MOVING' | 'IDLE' | 'OFFLINE' | 'MAINTENANCE' | 'UNKNOWN';
  isRentalReady: boolean;
};

export function VehicleForm({
  companies,
  vehicle,
}: {
  companies: readonly ManageableCompany[];
  vehicle?: EditableVehicle;
}) {
  const [state, action, pending] = useActionState(
    vehicle ? updateVehicleAction : createVehicleAction,
    initialState,
  );
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
      {vehicle && <input type="hidden" name="vehicleId" value={vehicle.id} />}
      <section className="grid gap-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-2 sm:p-6">
        {vehicle || companies.length === 1 ? (
          <input type="hidden" name="companyId" value={vehicle?.companyId ?? companies[0]?.id} />
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
          defaultValue={vehicle?.internalNumber}
          error={fieldError('internalNumber')}
        />
        <Input
          name="registrationNumber"
          label="Государственный номер"
          required
          defaultValue={vehicle?.registrationNumber}
          error={fieldError('registrationNumber')}
        />
        <Input
          name="make"
          label="Марка"
          required
          defaultValue={vehicle?.make}
          error={fieldError('make')}
        />
        <Input
          name="model"
          label="Модель"
          required
          defaultValue={vehicle?.model}
          error={fieldError('model')}
        />
        <Input
          name="year"
          type="number"
          min="1950"
          label="Год выпуска"
          required
          defaultValue={vehicle?.year}
          error={fieldError('year')}
        />
        <Input name="vin" label="VIN" defaultValue={vehicle?.vin ?? ''} error={fieldError('vin')} />
        <Input
          name="city"
          label="Город"
          required
          defaultValue={vehicle?.city}
          error={fieldError('city')}
        />
        <Input
          name="dailyPriceRubles"
          inputMode="decimal"
          label="Суточный тариф, ₽"
          required
          defaultValue={vehicle?.dailyPriceRubles}
          error={fieldError('dailyPriceRubles')}
        />
        <Select
          name="transmission"
          label="Коробка передач"
          required
          defaultValue={vehicle?.transmission ?? 'АКПП'}
          error={fieldError('transmission')}
        >
          <option>АКПП</option>
          <option>МКПП</option>
        </Select>
        <Select
          name="fuelType"
          label="Топливо"
          required
          defaultValue={vehicle?.fuelType ?? 'PETROL'}
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
          defaultValue={vehicle?.seats ?? 5}
          label="Количество мест"
          required
          error={fieldError('seats')}
        />
        <Select
          name="status"
          label="Статус"
          required
          defaultValue={vehicle?.status ?? 'UNKNOWN'}
          error={fieldError('status')}
        >
          <option value="UNKNOWN">Неизвестен</option>
          <option value="IDLE">Свободен</option>
          <option value="MAINTENANCE">На обслуживании</option>
          <option value="OFFLINE">Нет связи</option>
          <option value="MOVING">В пути</option>
        </Select>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium sm:col-span-2">
          <Switch name="isRentalReady" value="true" defaultChecked={vehicle?.isRentalReady} /> Готов
          к аренде
        </label>
      </section>
      {!state.ok && state.message && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          {vehicle ? 'Сохранить изменения' : 'Сохранить автомобиль'}
        </Button>
      </div>
    </form>
  );
}
