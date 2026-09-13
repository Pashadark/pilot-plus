'use client';

import Image from 'next/image';
import { useActionState, useCallback, useMemo, useRef, useState } from 'react';
import { FiFileText, FiImage, FiPlus, FiTrash2 } from 'react-icons/fi';

import { createRepairAction } from '../actions';
import type { RepairRentalOptionDto } from '../server/queries';
import type { OperationActionState } from '../types';
import type { VehicleOptionDto } from '@/modules/vehicles/types';
import { Button, Input, Select, Textarea } from '@/shared/ui';

const initialState: OperationActionState = { status: 'idle' };

function FileField({
  label,
  name,
  accept,
  icon,
}: {
  label: string;
  name: string;
  accept: string;
  icon: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-elevated)] p-3 text-sm">
      <span className="flex items-center gap-2 font-semibold text-[var(--color-text)]">
        {icon}
        {label}
      </span>
      <input
        aria-label={label}
        name={name}
        type="file"
        accept={accept}
        multiple
        className="min-w-0 text-xs text-[var(--color-text-secondary)] file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--color-primary-soft)] file:px-3 file:py-2 file:font-semibold file:text-[var(--color-primary)]"
      />
    </label>
  );
}

export function RepairForm({
  vehicles,
  rentals,
  initialVehicleId = '',
  onCancel,
  onSuccess,
}: {
  vehicles: readonly VehicleOptionDto[];
  rentals: readonly RepairRentalOptionDto[];
  initialVehicleId?: string;
  onCancel: () => void;
  onSuccess: (message: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [vehicleId, setVehicleId] = useState(
    vehicles.some((vehicle) => vehicle.id === initialVehicleId) ? initialVehicleId : '',
  );
  const [workItemCount, setWorkItemCount] = useState(1);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const availableRentals = useMemo(
    () => rentals.filter((rental) => !vehicleId || rental.vehicleId === vehicleId),
    [rentals, vehicleId],
  );
  const submitAction = useCallback(
    async (previousState: OperationActionState, formData: FormData) => {
      const nextState = await createRepairAction(previousState, formData);
      if (nextState.status === 'success' && nextState.message) {
        formRef.current?.reset();
        onSuccess(nextState.message);
      }
      return nextState;
    },
    [onSuccess],
  );
  const [state, formAction, pending] = useActionState(submitAction, initialState);

  return (
    <form ref={formRef} action={formAction} className="grid min-w-0 gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
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
        <Select label="Связанный договор (необязательно)" name="rentalId" defaultValue="">
          <option value="">Без договора</option>
          {availableRentals.map((rental) => (
            <option key={rental.id} value={rental.id}>
              {rental.label}
            </option>
          ))}
        </Select>
      </div>

      {selectedVehicle?.image ? (
        <div className="flex min-w-0 items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-3">
          <Image
            src={selectedVehicle.image.localPath}
            alt={selectedVehicle.image.alt}
            width={88}
            height={60}
            className="h-[3.75rem] w-[5.5rem] shrink-0 rounded-[var(--radius-sm)] object-cover"
          />
          <p className="min-w-0 text-sm font-semibold break-words">{selectedVehicle.label}</p>
        </div>
      ) : null}

      <Input
        label="Название ремонта"
        name="title"
        placeholder="Например, повреждение заднего бампера"
        error={state.fieldErrors?.title}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Дата повреждения"
          name="damageReportedAt"
          type="datetime-local"
          error={state.fieldErrors?.damageReportedAt}
          required
        />
        <Select
          label="Статус"
          name="status"
          defaultValue="DAMAGE_REPORTED"
          error={state.fieldErrors?.status}
        >
          <option value="DAMAGE_REPORTED">Повреждение зафиксировано</option>
          <option value="WAITING_REPAIR">Ожидает ремонта</option>
          <option value="IN_PROGRESS">Ремонт начат</option>
        </Select>
      </div>
      <Textarea
        label="Что повреждено"
        name="description"
        placeholder="Опишите повреждения и обстоятельства"
        error={state.fieldErrors?.description}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="Пробег, км"
          name="odometerKm"
          type="number"
          min="0"
          step="0.1"
          error={state.fieldErrors?.odometerKm}
        />
        <Input label="Сервис или подрядчик" name="provider" error={state.fieldErrors?.provider} />
        <Input
          label="Общая стоимость, ₽"
          name="costRubles"
          type="number"
          min="0"
          step="0.01"
          error={state.fieldErrors?.costRubles}
        />
      </div>

      <fieldset className="grid gap-3 rounded-[var(--radius-md)] border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <legend className="font-semibold text-[var(--color-text)]">Виды работ</legend>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            leadingIcon={<FiPlus aria-hidden />}
            onClick={() => setWorkItemCount((count) => Math.min(count + 1, 25))}
          >
            Добавить вид работ
          </Button>
        </div>
        {Array.from({ length: workItemCount }, (_, index) => (
          <div key={index} className="grid min-w-0 gap-2 sm:grid-cols-[1fr_1fr_9rem_auto]">
            <Input label={`Работа ${index + 1}`} name="workItemTitle" placeholder="Диагностика" />
            <Input label="Описание" name="workItemDescription" placeholder="Что сделать" />
            <Input
              label="Стоимость, ₽"
              name="workItemCostRubles"
              type="number"
              min="0"
              step="0.01"
            />
            {workItemCount > 1 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Удалить работу ${index + 1}`}
                className="self-end"
                onClick={() => setWorkItemCount((count) => Math.max(1, count - 1))}
              >
                <FiTrash2 aria-hidden />
              </Button>
            ) : null}
          </div>
        ))}
        {state.fieldErrors?.workItems ? (
          <p className="text-sm text-[var(--color-danger)]">{state.fieldErrors.workItems}</p>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-2 font-semibold text-[var(--color-text)]">
          Фото и документы{' '}
          <span className="font-normal text-[var(--color-text-tertiary)]">— необязательно</span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <FileField
            label="Фото повреждений"
            name="damageBeforeFiles"
            accept="image/jpeg,image/png,image/webp"
            icon={<FiImage aria-hidden />}
          />
          <FileField
            label="Фото после ремонта"
            name="repairAfterFiles"
            accept="image/jpeg,image/png,image/webp"
            icon={<FiImage aria-hidden />}
          />
          <FileField
            label="Документы и заказ-наряды"
            name="documentFiles"
            accept="application/pdf,.docx,image/jpeg,image/png,image/webp"
            icon={<FiFileText aria-hidden />}
          />
          <FileField
            label="Чеки"
            name="receiptFiles"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            icon={<FiFileText aria-hidden />}
          />
        </div>
      </fieldset>

      <Textarea label="Комментарий" name="notes" error={state.fieldErrors?.notes} />
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
          {pending ? 'Сохраняем…' : 'Сохранить ремонт'}
        </Button>
      </div>
    </form>
  );
}
