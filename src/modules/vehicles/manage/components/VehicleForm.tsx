'use client';

import { useActionState, useEffect } from 'react';

import { createVehicleAction, updateVehicleAction, type VehicleActionState } from '../actions';
import { Button, Input, Select, Switch } from '@/shared/ui';
import { useToast } from '@/shared/providers/ToastProvider';
import type { VehicleDriveType } from '../../technical-features';

const initialState: VehicleActionState = { ok: false, code: 'IDLE', message: '' };

export type ManageableCompany = { id: string; label: string; canArchive: boolean };
export type EditableVehicle = {
  id: string;
  companyId: string;
  internalNumber: string;
  registrationNumber: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  city: string;
  dailyPriceRubles: string;
  transmission: string;
  fuelType: 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'OTHER';
  seats: number;
  status: 'MOVING' | 'IDLE' | 'OFFLINE' | 'MAINTENANCE' | 'UNKNOWN';
  isRentalReady: boolean;
  color?: string | null;
  category?: string | null;
  bodyType?: string | null;
  engineLiters?: string | null;
  driveType?: VehicleDriveType;
  fuelConsumptionLitersPer100Km?: string | null;
  odometerKm?: string | null;
  fuelLevelPercent?: number | null;
  valueRubles?: string;
  rangePriceRubles?: string;
  depositRubles?: string;
  includedMileageKm?: number | null;
  overageMileagePriceRubles?: string;
  missingFuelPriceRubles?: string;
  office?: string | null;
  registrationCertificateNumber?: string | null;
  vehiclePassportNumber?: string | null;
  osagoInsurer?: string | null;
  osagoPolicyNumber?: string | null;
  osagoStartsAt?: string;
  osagoEndsAt?: string;
  cascoInsurer?: string | null;
  cascoPolicyNumber?: string | null;
  cascoStartsAt?: string;
  cascoEndsAt?: string;
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
          defaultValue={vehicle?.registrationNumber ?? ''}
          error={fieldError('registrationNumber')}
        />
        <Input
          name="make"
          label="Марка"
          required
          defaultValue={vehicle?.make ?? ''}
          error={fieldError('make')}
        />
        <Input
          name="model"
          label="Модель"
          required
          defaultValue={vehicle?.model ?? ''}
          error={fieldError('model')}
        />
        <Input
          name="year"
          type="number"
          min="1950"
          label="Год выпуска"
          required
          defaultValue={vehicle?.year ?? ''}
          error={fieldError('year')}
        />
        <Input name="vin" label="VIN" defaultValue={vehicle?.vin ?? ''} error={fieldError('vin')} />
        <Input
          name="color"
          label="Цвет"
          defaultValue={vehicle?.color ?? ''}
          error={fieldError('color')}
        />
        <Input
          name="category"
          label="Категория"
          defaultValue={vehicle?.category ?? ''}
          error={fieldError('category')}
        />
        <Input
          name="bodyType"
          label="Тип кузова"
          defaultValue={vehicle?.bodyType ?? ''}
          error={fieldError('bodyType')}
        />
        <Input
          name="city"
          label="Город"
          required
          defaultValue={vehicle?.city}
          error={fieldError('city')}
        />
        <Input
          name="office"
          label="Офис / площадка"
          defaultValue={vehicle?.office ?? ''}
          error={fieldError('office')}
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
        <Input
          name="engineLiters"
          type="number"
          min="0"
          step="0.1"
          label="Объём двигателя, л"
          defaultValue={vehicle?.engineLiters ?? ''}
          error={fieldError('engineLiters')}
        />
        <Select
          name="driveType"
          label="Привод"
          defaultValue={vehicle?.driveType ?? ''}
          error={fieldError('driveType')}
        >
          <option value="">Не указан</option>
          <option value="FRONT">Передний</option>
          <option value="REAR">Задний</option>
          <option value="ALL_WHEEL">Полный</option>
        </Select>
        <Input
          name="fuelConsumptionLitersPer100Km"
          type="number"
          min="0"
          max="99.9"
          step="0.1"
          label="Средний расход, л/100 км"
          defaultValue={vehicle?.fuelConsumptionLitersPer100Km ?? ''}
          error={fieldError('fuelConsumptionLitersPer100Km')}
        />
        <Input
          name="odometerKm"
          type="number"
          min="0"
          step="0.1"
          label="Пробег, км"
          defaultValue={vehicle?.odometerKm ?? ''}
          error={fieldError('odometerKm')}
        />
        {vehicle && (
          <Input
            name="fuelLevelPercent"
            type="number"
            min="0"
            max="100"
            step="1"
            inputMode="numeric"
            label="Текущий уровень топлива, %"
            defaultValue={vehicle.fuelLevelPercent ?? ''}
            error={fieldError('fuelLevelPercent')}
          />
        )}
        <Input
          name="valueRubles"
          inputMode="decimal"
          label="Стоимость автомобиля, ₽"
          defaultValue={vehicle?.valueRubles ?? ''}
          error={fieldError('valueRubles')}
        />
        <Input
          name="rangePriceRubles"
          inputMode="decimal"
          label="Тариф диапазона, ₽"
          defaultValue={vehicle?.rangePriceRubles ?? ''}
          error={fieldError('rangePriceRubles')}
        />
        <Input
          name="depositRubles"
          inputMode="decimal"
          label="Залог, ₽"
          defaultValue={vehicle?.depositRubles ?? ''}
          error={fieldError('depositRubles')}
        />
        <Input
          name="includedMileageKm"
          type="number"
          min="0"
          label="Включённый пробег, км"
          defaultValue={vehicle?.includedMileageKm ?? ''}
          error={fieldError('includedMileageKm')}
        />
        <Input
          name="overageMileagePriceRubles"
          inputMode="decimal"
          label="Перепробег, ₽/км"
          defaultValue={vehicle?.overageMileagePriceRubles ?? ''}
          error={fieldError('overageMileagePriceRubles')}
        />
        <Input
          name="missingFuelPriceRubles"
          inputMode="decimal"
          label="Недостающее топливо, ₽/л"
          defaultValue={vehicle?.missingFuelPriceRubles ?? ''}
          error={fieldError('missingFuelPriceRubles')}
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
        <h2 className="pt-2 text-lg font-bold sm:col-span-2">Документы и страхование</h2>
        <Input
          name="registrationCertificateNumber"
          label="СТС"
          defaultValue={vehicle?.registrationCertificateNumber ?? ''}
          error={fieldError('registrationCertificateNumber')}
        />
        <Input
          name="vehiclePassportNumber"
          label="ПТС"
          defaultValue={vehicle?.vehiclePassportNumber ?? ''}
          error={fieldError('vehiclePassportNumber')}
        />
        <Input
          name="osagoInsurer"
          label="Страховая ОСАГО"
          defaultValue={vehicle?.osagoInsurer ?? ''}
          error={fieldError('osagoInsurer')}
        />
        <Input
          name="osagoPolicyNumber"
          label="Полис ОСАГО"
          defaultValue={vehicle?.osagoPolicyNumber ?? ''}
          error={fieldError('osagoPolicyNumber')}
        />
        <Input
          name="osagoStartsAt"
          type="date"
          label="ОСАГО действует с"
          defaultValue={vehicle?.osagoStartsAt ?? ''}
          error={fieldError('osagoStartsAt')}
        />
        <Input
          name="osagoEndsAt"
          type="date"
          label="ОСАГО действует до"
          defaultValue={vehicle?.osagoEndsAt ?? ''}
          error={fieldError('osagoEndsAt')}
        />
        <Input
          name="cascoInsurer"
          label="Страховая КАСКО"
          defaultValue={vehicle?.cascoInsurer ?? ''}
          error={fieldError('cascoInsurer')}
        />
        <Input
          name="cascoPolicyNumber"
          label="Полис КАСКО"
          defaultValue={vehicle?.cascoPolicyNumber ?? ''}
          error={fieldError('cascoPolicyNumber')}
        />
        <Input
          name="cascoStartsAt"
          type="date"
          label="КАСКО действует с"
          defaultValue={vehicle?.cascoStartsAt ?? ''}
          error={fieldError('cascoStartsAt')}
        />
        <Input
          name="cascoEndsAt"
          type="date"
          label="КАСКО действует до"
          defaultValue={vehicle?.cascoEndsAt ?? ''}
          error={fieldError('cascoEndsAt')}
        />
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
