'use client';

import Image from 'next/image';
import { useActionState, useCallback, useRef, useState } from 'react';

import { createWashAction } from '../actions';
import type { OperationActionState } from '../types';
import type { VehicleOptionDto } from '@/modules/vehicles/types';
import { Button, Input, Select, Textarea } from '@/shared/ui';

const initialState: OperationActionState = { status: 'idle' };

export function WashForm({
  vehicles,
  onCancel,
  onSuccess,
}: {
  vehicles: readonly VehicleOptionDto[];
  onCancel: () => void;
  onSuccess: (message: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitAction = useCallback(
    async (previousState: OperationActionState, formData: FormData) => {
      const nextState = await createWashAction(previousState, formData);
      if (nextState.status === 'success' && nextState.message) {
        formRef.current?.reset();
        onSuccess(nextState.message);
      }
      return nextState;
    },
    [onSuccess],
  );
  const [state, formAction, pending] = useActionState(submitAction, initialState);
  const [vehicleId, setVehicleId] = useState('');
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);

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
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Select
          label="Тип мойки"
          name="kind"
          defaultValue=""
          error={state.fieldErrors?.kind}
          required
        >
          <option value="">Выберите тип</option>
          <option value="BODY">Кузов</option>
          <option value="COMPLEX">Комплексная</option>
          <option value="INTERIOR">Салон</option>
          <option value="MATS">Коврики</option>
          <option value="ENGINE">Двигатель</option>
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
          label="Мойка или подрядчик"
          name="provider"
          placeholder="Например, Чистый парк"
          error={state.fieldErrors?.provider}
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
      <Textarea
        label="Примечание"
        name="notes"
        placeholder="Особые требования к мойке"
        error={state.fieldErrors?.notes}
      />
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
          {pending ? 'Сохраняем…' : 'Сохранить мойку'}
        </Button>
      </div>
    </form>
  );
}
