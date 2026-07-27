'use client';

import { useActionState, useCallback, useRef } from 'react';

import { createDeviceAction } from '../actions';
import type { DeviceActionState, FirmwareReleaseItem } from '../types';
import { Button, Input, Select } from '@/shared/ui';

const initialState: DeviceActionState = { success: false, message: '' };

export function DeviceForm({
  firmwareReleases,
  vehicles,
  onCancel,
  onSuccess,
}: {
  firmwareReleases: readonly FirmwareReleaseItem[];
  vehicles: readonly { id: string; label: string }[];
  onCancel: () => void;
  onSuccess: (message: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitAction = useCallback(
    async (previousState: DeviceActionState, formData: FormData) => {
      const nextState = await createDeviceAction(previousState, formData);
      if (nextState.success) {
        formRef.current?.reset();
        onSuccess(nextState.message);
      }
      return nextState;
    },
    [onSuccess],
  );
  const [state, formAction, pending] = useActionState(submitAction, initialState);

  return (
    <form ref={formRef} action={formAction} className="grid min-w-0 gap-4">
      <Input
        label="Название устройства"
        name="name"
        placeholder="Например, Pilot Connect 0147"
        error={state.fieldErrors?.name?.[0]}
        required
      />
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Input
          label="Серийный номер"
          name="serialNumber"
          placeholder="PC-0147-001"
          error={state.fieldErrors?.serialNumber?.[0]}
          required
        />
        <Input
          label="IMEI"
          name="imei"
          inputMode="numeric"
          pattern="[0-9]{15}"
          placeholder="15 цифр"
          error={state.fieldErrors?.imei?.[0]}
          required
        />
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Input
          label="Версия оборудования"
          name="hardwareVersion"
          placeholder="2.1.0"
          hint="Три числа через точку, например 2.1.0"
          error={state.fieldErrors?.hardwareVersion?.[0]}
          required
        />
        <Select
          label="Начальная прошивка"
          name="firmwareVersion"
          defaultValue=""
          error={state.fieldErrors?.firmwareVersion?.[0]}
          required
        >
          <option value="">Выберите версию</option>
          {firmwareReleases.map((release) => (
            <option key={release.id} value={release.version}>
              {release.version}
              {release.channel === 'BETA' ? ' · beta' : ''}
            </option>
          ))}
        </Select>
      </div>
      <Select
        label="Автомобиль"
        name="vehicleId"
        defaultValue=""
        error={state.fieldErrors?.vehicleId?.[0]}
      >
        <option value="">Не привязывать сейчас</option>
        {vehicles.map((vehicle) => (
          <option key={vehicle.id} value={vehicle.id}>
            {vehicle.label}
          </option>
        ))}
      </Select>
      {!state.success && state.message ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Отмена
        </Button>
        <Button type="submit" loading={pending}>
          {pending ? 'Добавляем…' : 'Добавить устройство'}
        </Button>
      </div>
    </form>
  );
}
