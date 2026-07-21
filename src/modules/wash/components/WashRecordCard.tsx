'use client';

import {
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiDroplet,
  FiMapPin,
  FiPlay,
  FiSlash,
  FiX,
} from 'react-icons/fi';

import type { WashRecordDto } from '../server/queries';
import type { WashKind, WashStatus } from '../types';
import { Badge, Button, Card } from '@/shared/ui';

export const washStatusView: Record<
  WashStatus,
  {
    label: string;
    tone: 'neutral' | 'primary' | 'success' | 'warning';
    icon: React.ReactNode;
  }
> = {
  PLANNED: {
    label: 'Запланировано',
    tone: 'primary',
    icon: <FiCalendar aria-hidden="true" />,
  },
  IN_PROGRESS: {
    label: 'В работе',
    tone: 'warning',
    icon: <FiDroplet aria-hidden="true" />,
  },
  COMPLETED: {
    label: 'Завершено',
    tone: 'success',
    icon: <FiCheck aria-hidden="true" />,
  },
  CANCELLED: {
    label: 'Отменено',
    tone: 'neutral',
    icon: <FiSlash aria-hidden="true" />,
  },
};

export const washKindLabels: Record<WashKind, string> = {
  BODY: 'Кузов',
  COMPLEX: 'Комплексная',
  INTERIOR: 'Салон',
  MATS: 'Коврики',
  ENGINE: 'Двигатель',
  OTHER: 'Другое',
};

type TransitionFormAction = (formData: FormData) => void;

export type WashTransitionControls = {
  formAction: TransitionFormAction;
  pending: boolean;
};

export function formatWashDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatWashCost(value: number | null) {
  if (value === null) return 'Не указана';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function WashStatusBadge({ status }: { status: WashStatus }) {
  const view = washStatusView[status];
  return (
    <Badge tone={view.tone} className="gap-1.5">
      {view.icon}
      {view.label}
    </Badge>
  );
}

export function WashRecordActions({
  record,
  formAction,
  pending,
}: { record: WashRecordDto } & WashTransitionControls) {
  const canStart = record.status === 'PLANNED';
  const canComplete = record.status === 'IN_PROGRESS';
  const canCancel = canStart || canComplete;

  if (!canStart && !canComplete && !canCancel) return null;

  return (
    <form action={formAction} className="flex min-w-0 flex-wrap gap-2">
      <input type="hidden" name="recordId" value={record.id} />
      <input type="hidden" name="fromStatus" value={record.status} />
      {canStart ? (
        <Button
          type="submit"
          name="toStatus"
          value="IN_PROGRESS"
          size="sm"
          loading={pending}
          leadingIcon={<FiPlay aria-hidden="true" />}
        >
          {pending ? 'Обновляем…' : 'Начать мойку'}
        </Button>
      ) : null}
      {canComplete ? (
        <Button
          type="submit"
          name="toStatus"
          value="COMPLETED"
          size="sm"
          loading={pending}
          leadingIcon={<FiCheckCircle aria-hidden="true" />}
        >
          {pending ? 'Обновляем…' : 'Завершить мойку'}
        </Button>
      ) : null}
      {canCancel ? (
        <Button
          type="submit"
          name="toStatus"
          value="CANCELLED"
          size="sm"
          variant="ghost"
          disabled={pending}
          leadingIcon={<FiX aria-hidden="true" />}
        >
          Отменить
        </Button>
      ) : null}
    </form>
  );
}

export function WashRecordCard({
  record,
  formAction,
  pending,
  testId = 'wash-record',
}: WashTransitionControls & {
  record: WashRecordDto;
  testId?: string;
}) {
  return (
    <Card className="min-w-0 p-4" data-testid={testId}>
      <article className="grid min-w-0 gap-4">
        <header className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-[var(--color-text-tertiary)]">
              {washKindLabels[record.kind]}
            </p>
            <h2 className="text-base font-bold break-words text-[var(--color-text)]">
              {record.vehicle.internalNumber} · {record.vehicle.model}
            </h2>
          </div>
          <WashStatusBadge status={record.status} />
        </header>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex min-w-0 gap-2">
            <FiMapPin aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
            <div className="min-w-0">
              <dt className="text-xs text-[var(--color-text-tertiary)]">Автомобиль</dt>
              <dd className="font-medium break-words">
                {record.vehicle.registrationNumber ?? 'Госномер не указан'}
              </dd>
            </div>
          </div>
          <div className="flex min-w-0 gap-2">
            <FiCalendar
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[var(--color-primary)]"
            />
            <div>
              <dt className="text-xs text-[var(--color-text-tertiary)]">Плановая дата</dt>
              <dd>{formatWashDate(record.scheduledAt)}</dd>
            </div>
          </div>
          <div className="flex min-w-0 gap-2">
            <FiClock aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
            <div>
              <dt className="text-xs text-[var(--color-text-tertiary)]">Подрядчик</dt>
              <dd className="break-words">{record.provider ?? 'Не указан'}</dd>
            </div>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-text-tertiary)]">Стоимость</dt>
            <dd>{formatWashCost(record.costMinor)}</dd>
          </div>
        </dl>
        {record.notes ? (
          <p className="text-sm break-words text-[var(--color-text-secondary)]">{record.notes}</p>
        ) : null}
        <WashRecordActions record={record} formAction={formAction} pending={pending} />
      </article>
    </Card>
  );
}
