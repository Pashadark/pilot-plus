'use client';

import { useActionState, useCallback, useState } from 'react';

import { bindDeviceAction } from '../actions';
import type { DeviceActionState, DeviceVehicleSummary } from '../types';
import { useToast } from '@/shared/providers/ToastProvider';
import { Button, Modal, Select } from '@/shared/ui';

const initialState: DeviceActionState = { success: false, message: '' };

export function DeviceBindingDialog({
  deviceId,
  vehicle,
  availableVehicles,
  onSuccess,
}: {
  deviceId: string;
  vehicle: DeviceVehicleSummary | null;
  availableVehicles: readonly { id: string; label: string }[];
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState(vehicle?.id ?? '');
  const { showToast } = useToast();
  const action = useCallback(
    async (previousState: DeviceActionState, formData: FormData) => {
      const nextState = await bindDeviceAction(previousState, formData);
      if (nextState.success) {
        showToast({ tone: 'success', title: nextState.message });
        setOpen(false);
        onSuccess?.();
      } else if (nextState.message) {
        showToast({ tone: 'danger', title: nextState.message });
      }
      return nextState;
    },
    [onSuccess, showToast],
  );
  const [state, formAction, pending] = useActionState(action, initialState);
  const vehicles = [
    ...(vehicle ? [{ id: vehicle.id, label: vehicle.label }] : []),
    ...availableVehicles.filter((item) => item.id !== vehicle?.id),
  ];

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {vehicle ? 'Изменить привязку' : 'Привязать автомобиль'}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={vehicle ? 'Изменить привязку' : 'Привязать автомобиль'}
        description="Доступны только свободные автомобили вашей компании."
      >
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="deviceId" value={deviceId} />
          <Select
            label="Автомобиль"
            name="vehicleId"
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
            error={state.fieldErrors?.vehicleId?.[0]}
          >
            <option value="">Не привязывать автомобиль</option>
            {vehicles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
          {!state.success && state.message ? (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {state.message}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Отмена
            </Button>
            <Button type="submit" loading={pending}>
              Сохранить привязку
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
