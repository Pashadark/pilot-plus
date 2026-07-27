'use client';

import { useActionState, useCallback, useMemo, useState } from 'react';

import { createDeviceCommandAction } from '../actions';
import type { DeviceActionState, DeviceCommandType, FirmwareReleaseItem } from '../types';
import { useToast } from '@/shared/providers/ToastProvider';
import { Button, Modal, Select } from '@/shared/ui';

const initialState: DeviceActionState = { success: false, message: '' };

const commandMeta: Record<
  DeviceCommandType,
  {
    trigger: string;
    title: string;
    confirm: string;
    description: (name: string, serial: string) => string;
  }
> = {
  REBOOT: {
    trigger: 'Перезагрузить',
    title: 'Перезагрузить устройство',
    confirm: 'Подтвердить перезагрузку',
    description: (name) => `В очередь будет добавлена команда перезагрузки для ${name}.`,
  },
  SHUTDOWN: {
    trigger: 'Выключить',
    title: 'Выключить устройство',
    confirm: 'Подтвердить выключение',
    description: (name, serial) => `Будет добавлена команда выключения для ${name} (${serial}).`,
  },
  UPDATE_FIRMWARE: {
    trigger: 'Обновить прошивку',
    title: 'Обновить прошивку',
    confirm: 'Добавить в очередь',
    description: () => 'Выберите доступную более новую версию прошивки.',
  },
};

export function DeviceCommandDialog({
  deviceId,
  deviceName,
  serialNumber,
  type,
  firmwareReleases = [],
  disabled = false,
  onSuccess,
}: {
  deviceId: string;
  deviceName: string;
  serialNumber: string;
  type: DeviceCommandType;
  firmwareReleases?: readonly FirmwareReleaseItem[];
  disabled?: boolean;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();
  const meta = commandMeta[type];
  const updates = useMemo(
    () => (type === 'UPDATE_FIRMWARE' ? firmwareReleases : []),
    [firmwareReleases, type],
  );
  const action = useCallback(
    async (previousState: DeviceActionState, formData: FormData) => {
      const nextState = await createDeviceCommandAction(previousState, formData);
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

  if (type === 'UPDATE_FIRMWARE' && updates.length === 0) return null;

  return (
    <>
      <Button
        type="button"
        variant={type === 'SHUTDOWN' ? 'danger' : 'secondary'}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        {meta.trigger}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={meta.title}
        description={meta.description(deviceName, serialNumber)}
      >
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="deviceId" value={deviceId} />
          <input type="hidden" name="type" value={type} />
          {type === 'UPDATE_FIRMWARE' ? (
            <Select
              label="Версия прошивки"
              name="firmwareReleaseId"
              defaultValue={updates[0]?.id}
              required
            >
              {updates.map((release) => (
                <option key={release.id} value={release.id}>
                  {release.version}
                  {release.channel === 'BETA' ? ' · beta' : ''}
                </option>
              ))}
            </Select>
          ) : null}
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
            <Button
              type="submit"
              variant={type === 'SHUTDOWN' ? 'danger' : 'primary'}
              loading={pending}
            >
              {meta.confirm}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
