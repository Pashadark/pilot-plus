'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useCallback, useMemo, useState } from 'react';
import { FiMoreHorizontal } from 'react-icons/fi';

import { bindDeviceAction, createDeviceCommandAction } from '../actions';
import { canUpdateFirmware } from '../firmware';
import type { DeviceActionState, DeviceListItem, FirmwareReleaseItem } from '../types';
import { useToast } from '@/shared/providers/ToastProvider';
import { Button, DropdownMenu, Modal, Select } from '@/shared/ui';

type DialogKind = 'reboot' | 'shutdown' | 'update' | 'binding' | null;

const initialState: DeviceActionState = { success: false, message: '' };

function MenuItem({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-11 w-full items-center rounded-[var(--radius-sm)] px-3 text-left text-sm font-medium hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-55"
    >
      {children}
    </button>
  );
}

export function DeviceListActions({
  device,
  firmwareReleases,
  availableVehicles,
}: {
  device: DeviceListItem;
  firmwareReleases: readonly FirmwareReleaseItem[];
  availableVehicles: readonly { id: string; label: string }[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [vehicleId, setVehicleId] = useState(device.vehicle?.id ?? '');
  const availableUpdates = useMemo(
    () =>
      firmwareReleases.filter((release) =>
        canUpdateFirmware(device.firmwareVersion, release.version),
      ),
    [device.firmwareVersion, firmwareReleases],
  );
  const vehicleOptions = useMemo(() => {
    const currentVehicle = device.vehicle
      ? [{ id: device.vehicle.id, label: device.vehicle.label }]
      : [];
    return [
      ...currentVehicle,
      ...availableVehicles.filter((vehicle) => vehicle.id !== device.vehicle?.id),
    ];
  }, [availableVehicles, device.vehicle]);
  const handleSuccess = useCallback(
    (message: string) => {
      showToast({ tone: 'success', title: message });
      setDialog(null);
      router.refresh();
    },
    [router, showToast],
  );
  const commandAction = useCallback(
    async (previousState: DeviceActionState, formData: FormData) => {
      const nextState = await createDeviceCommandAction(previousState, formData);
      if (nextState.success) handleSuccess(nextState.message);
      else if (nextState.message) showToast({ tone: 'danger', title: nextState.message });
      return nextState;
    },
    [handleSuccess, showToast],
  );
  const bindingAction = useCallback(
    async (previousState: DeviceActionState, formData: FormData) => {
      const nextState = await bindDeviceAction(previousState, formData);
      if (nextState.success) handleSuccess(nextState.message);
      else if (nextState.message) showToast({ tone: 'danger', title: nextState.message });
      return nextState;
    },
    [handleSuccess, showToast],
  );
  const [commandState, commandFormAction, commandPending] = useActionState(
    commandAction,
    initialState,
  );
  const [bindingState, bindingFormAction, bindingPending] = useActionState(
    bindingAction,
    initialState,
  );
  const closeDialog = useCallback(() => setDialog(null), []);
  const commandError =
    !commandState.success && commandState.message ? (
      <p role="alert" className="text-sm text-[var(--color-danger)]">
        {commandState.message}
      </p>
    ) : null;

  return (
    <>
      <DropdownMenu
        ariaLabel={`Действия устройства ${device.name}`}
        label={<FiMoreHorizontal aria-hidden="true" className="mx-auto size-5" />}
      >
        <Link
          href={`/devices/${device.id}`}
          role="menuitem"
          className="flex min-h-11 items-center rounded-[var(--radius-sm)] px-3 text-sm font-medium hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
        >
          Открыть устройство
        </Link>
        <MenuItem disabled={device.hasActiveCommand} onClick={() => setDialog('reboot')}>
          Перезагрузить
        </MenuItem>
        <MenuItem disabled={device.hasActiveCommand} onClick={() => setDialog('shutdown')}>
          Выключить
        </MenuItem>
        {device.updateAvailable && availableUpdates.length ? (
          <MenuItem disabled={device.hasActiveCommand} onClick={() => setDialog('update')}>
            Обновить прошивку
          </MenuItem>
        ) : null}
        {device.hasActiveCommand ? (
          <span className="block px-3 py-2 text-xs text-[var(--color-warning)]">
            Команда ожидает отправки
          </span>
        ) : null}
        <MenuItem onClick={() => setDialog('binding')}>
          {device.vehicle ? 'Изменить привязку' : 'Привязать автомобиль'}
        </MenuItem>
      </DropdownMenu>

      <Modal
        open={dialog === 'reboot'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Перезагрузить устройство"
        description={`В очередь будет добавлена команда перезагрузки для ${device.name}.`}
      >
        <form action={commandFormAction} className="grid gap-4">
          <input type="hidden" name="deviceId" value={device.id} />
          <input type="hidden" name="type" value="REBOOT" />
          {commandError}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={closeDialog}
              disabled={commandPending}
            >
              Отмена
            </Button>
            <Button type="submit" loading={commandPending}>
              Подтвердить перезагрузку
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={dialog === 'shutdown'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Выключить устройство"
        description={`Будет добавлена команда выключения для ${device.name} (${device.serialNumber}).`}
      >
        <form action={commandFormAction} className="grid gap-4">
          <input type="hidden" name="deviceId" value={device.id} />
          <input type="hidden" name="type" value="SHUTDOWN" />
          {commandError}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={closeDialog}
              disabled={commandPending}
            >
              Отмена
            </Button>
            <Button type="submit" variant="danger" loading={commandPending}>
              Подтвердить выключение
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={dialog === 'update'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Обновить прошивку"
        description="Выберите доступную более новую версию прошивки."
      >
        <form action={commandFormAction} className="grid gap-4">
          <input type="hidden" name="deviceId" value={device.id} />
          <input type="hidden" name="type" value="UPDATE_FIRMWARE" />
          <Select
            label="Версия прошивки"
            name="firmwareReleaseId"
            defaultValue={availableUpdates[0]?.id ?? ''}
            required
          >
            {availableUpdates.map((release) => (
              <option key={release.id} value={release.id}>
                {release.version}
                {release.channel === 'BETA' ? ' · beta' : ''}
              </option>
            ))}
          </Select>
          {commandError}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={closeDialog}
              disabled={commandPending}
            >
              Отмена
            </Button>
            <Button type="submit" loading={commandPending}>
              Добавить в очередь
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={dialog === 'binding'}
        onOpenChange={(open) => !open && closeDialog()}
        title={device.vehicle ? 'Изменить привязку' : 'Привязать автомобиль'}
        description="Доступны только свободные автомобили вашей компании."
      >
        <form action={bindingFormAction} className="grid gap-4">
          <input type="hidden" name="deviceId" value={device.id} />
          <Select
            label="Автомобиль"
            name="vehicleId"
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
            error={bindingState.fieldErrors?.vehicleId?.[0]}
          >
            <option value="">Не привязывать автомобиль</option>
            {vehicleOptions.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.label}
              </option>
            ))}
          </Select>
          {!bindingState.success && bindingState.message ? (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {bindingState.message}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={closeDialog}
              disabled={bindingPending}
            >
              Отмена
            </Button>
            <Button type="submit" loading={bindingPending}>
              Сохранить привязку
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
