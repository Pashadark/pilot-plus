'use client';

import { useState, type FormEvent } from 'react';

import { createManualEventAction, type EventActionState } from '../actions';
import { Button, Input, Modal, Select, Textarea } from '@/shared/ui';

const initialState: EventActionState = { status: 'idle', message: '' };

export function ManualEventDialog({
  open,
  onOpenChange,
  vehicles,
  onSuccess,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: readonly { id: string; label: string }[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [state, setState] = useState<EventActionState>(initialState);
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    const next = await createManualEventAction(state, new FormData(event.currentTarget));
    setPending(false);
    setState(next);
    if (next.status === 'success') {
      onSuccess(next.message);
      onOpenChange(false);
    } else if (next.status === 'error') onError(next.message);
  };
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Добавить запись"
      description="Запись увидят пользователи вашей компании."
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
    >
      <form className="grid gap-3" onSubmit={submit}>
        <Select label="Автомобиль" name="vehicleId" required defaultValue={vehicles[0]?.id ?? ''}>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.label}
            </option>
          ))}
        </Select>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Тип записи" name="kind" defaultValue="NOTE">
            <option value="NOTE">Заметка</option>
            <option value="INCIDENT">Происшествие</option>
            <option value="ASSIGNMENT">Назначение</option>
          </Select>
          <Select label="Важность" name="severity" defaultValue="INFO">
            <option value="INFO">Информация</option>
            <option value="WARNING">Предупреждение</option>
            <option value="DANGER">Критическое</option>
          </Select>
        </div>
        <Input label="Заголовок" name="title" required minLength={2} maxLength={120} />
        <Textarea label="Описание" name="description" maxLength={2000} />
        <Input label="Место" name="location" maxLength={240} />
        <Input
          label="Время события (ISO с часовым поясом)"
          name="recordedAt"
          required
          defaultValue={new Date().toISOString()}
        />
        {state.status === 'error' ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {state.message}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="submit" loading={pending}>
            Сохранить запись
          </Button>
        </div>
      </form>
    </Modal>
  );
}
