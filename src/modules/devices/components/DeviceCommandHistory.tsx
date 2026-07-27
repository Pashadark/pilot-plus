'use client';

import { useActionState, useCallback } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiClock, FiSend, FiSlash } from 'react-icons/fi';

import { cancelDeviceCommandAction } from '../actions';
import type { DeviceActionState, DeviceCommandItem, DeviceCommandStatus } from '../types';
import { useToast } from '@/shared/providers/ToastProvider';
import { Badge, Button, Card, CardContent, CardHeader } from '@/shared/ui';

const initialState: DeviceActionState = { success: false, message: '' };

const statusMeta: Record<
  DeviceCommandStatus,
  {
    label: string;
    tone: 'primary' | 'warning' | 'success' | 'danger' | 'neutral';
    icon: typeof FiClock;
  }
> = {
  PENDING: { label: 'Ожидает отправки', tone: 'warning', icon: FiClock },
  SENT: { label: 'Отправлена', tone: 'primary', icon: FiSend },
  COMPLETED: { label: 'Выполнена', tone: 'success', icon: FiCheckCircle },
  FAILED: { label: 'Ошибка', tone: 'danger', icon: FiAlertTriangle },
  CANCELLED: { label: 'Отменена', tone: 'neutral', icon: FiSlash },
};

const typeLabel: Record<DeviceCommandItem['type'], string> = {
  REBOOT: 'Перезагрузка',
  SHUTDOWN: 'Выключение',
  UPDATE_FIRMWARE: 'Обновление прошивки',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  }).format(new Date(value));
}

function CancelCommandButton({
  command,
  onSuccess,
}: {
  command: DeviceCommandItem;
  onSuccess?: () => void;
}) {
  const { showToast } = useToast();
  const action = useCallback(
    async (previousState: DeviceActionState, formData: FormData) => {
      const nextState = await cancelDeviceCommandAction(previousState, formData);
      if (nextState.success) {
        showToast({ tone: 'success', title: nextState.message });
        onSuccess?.();
      } else if (nextState.message) {
        showToast({ tone: 'danger', title: nextState.message });
      }
      return nextState;
    },
    [onSuccess, showToast],
  );
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid justify-items-start gap-2">
      <input type="hidden" name="commandId" value={command.id} />
      <Button type="submit" variant="ghost" loading={pending}>
        Отменить команду
      </Button>
      {!state.success && state.message ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function DeviceCommandHistory({
  commands,
  onSuccess,
}: {
  commands: readonly DeviceCommandItem[];
  onSuccess?: () => void;
}) {
  return (
    <Card data-testid="device-command-history">
      <CardHeader>
        <h2 className="font-bold">Очередь и журнал команд</h2>
      </CardHeader>
      <CardContent>
        {commands.length ? (
          <ol className="grid gap-4">
            {commands.map((command) => {
              const meta = statusMeta[command.status];
              const Icon = meta.icon;
              return (
                <li
                  key={command.id}
                  className="grid gap-2 border-b border-[var(--color-border)] pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{typeLabel[command.type]}</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        Автор: {command.createdByName ?? 'Неизвестный пользователь'} ·{' '}
                        {formatDate(command.createdAt)}
                      </p>
                    </div>
                    <Badge tone={meta.tone}>
                      <Icon aria-hidden="true" /> {meta.label}
                    </Badge>
                  </div>
                  {command.targetFirmwareVersion ? (
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Версия: {command.targetFirmwareVersion}
                    </p>
                  ) : null}
                  {command.errorMessage ? (
                    <p role="alert" className="text-sm text-[var(--color-danger)]">
                      {command.errorMessage}
                    </p>
                  ) : null}
                  {command.status === 'PENDING' ? (
                    <CancelCommandButton command={command} onSuccess={onSuccess} />
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Команд для этого устройства пока нет.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
