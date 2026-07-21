'use client';

import Image from 'next/image';
import { useActionState, useEffect, useRef, useState } from 'react';

import { createMaintenanceAction } from '../actions';
import type { OperationActionState } from '../types';
import type { VehicleOptionDto } from '@/modules/vehicles/types';
import { useToast } from '@/shared/providers/ToastProvider';
import { Button, Input, Select, Textarea } from '@/shared/ui';

const initialState: OperationActionState = { status: 'idle' };

export function MaintenanceForm({
  vehicles,
  onCancel,
  onSuccess,
}: {
  vehicles: readonly VehicleOptionDto[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState(createMaintenanceAction, initialState);
  const [vehicleId, setVehicleId] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const { showToast } = useToast();
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);

  useEffect(() => {
    if (!state.message || state.status === 'idle') return;
    showToast({
      tone: state.status === 'success' ? 'success' : 'danger',
      title: state.message,
    });
    if (state.status === 'success') {
      formRef.current?.reset();
      onSuccess();
    }
  }, [onSuccess, showToast, state]);

  return (
    <form ref={formRef} action={formAction} className="grid min-w-0 gap-4">
      <Select
        label="Автомобиль"
        name="vehicleId"
        value={vehicleId}
        onChange={(event) => setVehicleId(event.target.value)}
        error={state.fieldErrors?.vehicleId}
        required
      >
        <option value="">Выберите автомобиль</option>
        {vehicles.map((vehicle) => (
          <option key={vehicle.id} value={vehicle.id}>
            {vehicle.label}
          </option>
        ))}
      </Select>
      {selectedVehicle?.image ? (
        <div className="flex min-w-0 items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-3">
          <Image
            src={selectedVehicle.image.localPath}
            alt={selectedVehicle.image.alt}
            width={80}
            height={56}
            className="h-14 w-20 shrink-0 rounded-[var(--radius-sm)] object-cover"
          />
          <p className="min-w-0 text-sm font-medium break-words">{selectedVehicle.label}</p>
        </div>
      ) : null}
      <Input
        label="Название работы"
        name="title"
        placeholder="Например, замена масла"
        error={state.fieldErrors?.title}
        required
      />
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Select
          label="Вид работы"
          name="kind"
          defaultValue=""
          error={state.fieldErrors?.kind}
          required
        >
          <option value="">Выберите вид</option>
          <option value="OIL">Замена масла</option>
          <option value="FILTERS">Замена фильтров</option>
          <option value="BRAKES">Тормозная система</option>
          <option value="TIRES">Шины</option>
          <option value="TIMING">ГРМ</option>
          <option value="INSPECTION">Диагностика</option>
          <option value="OTHER">Другое</option>
        </Select>
        <Input
          label="Плановая дата"
          name="scheduledAt"
          type="datetime-local"
          error={state.fieldErrors?.scheduledAt}
          required
        />
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Input
          label="Плановый пробег, км"
          name="targetOdometerKm"
          type="number"
          min="0"
          max="99999999999.9"
          step="0.1"
          inputMode="decimal"
          error={state.fieldErrors?.targetOdometerKm}
        />
        <Input
          label="Стоимость, ₽"
          name="costRubles"
          type="number"
          min="0"
          max="10000000"
          step="0.01"
          inputMode="decimal"
          error={state.fieldErrors?.costRubles}
        />
      </div>
      <Input label="Сервис или подрядчик" name="provider" error={state.fieldErrors?.provider} />
      <Textarea label="Примечание" name="notes" error={state.fieldErrors?.notes} />
      {state.status === 'error' && state.message ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Отмена
        </Button>
        <Button type="submit" loading={pending}>
          {pending ? 'Сохраняем…' : 'Сохранить ТО'}
        </Button>
      </div>
    </form>
  );
}
