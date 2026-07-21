'use client';

import { FiCalendar, FiCheckCircle, FiClock, FiMapPin, FiPlay, FiX } from 'react-icons/fi';

import type { MaintenanceKind, MaintenanceStatus } from '../types';
import type { MaintenanceRecordDto } from '../server/queries';
import { Badge, Button, Card } from '@/shared/ui';

export const maintenanceStatusView: Record<
  MaintenanceStatus,
  { label: string; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }
> = {
  PLANNED: { label: 'Запланировано', tone: 'primary' },
  IN_PROGRESS: { label: 'В работе', tone: 'warning' },
  COMPLETED: { label: 'Завершено', tone: 'success' },
  OVERDUE: { label: 'Просрочено', tone: 'danger' },
  CANCELLED: { label: 'Отменено', tone: 'neutral' },
};

export const maintenanceKindLabels: Record<MaintenanceKind, string> = {
  OIL: 'Масло',
  FILTERS: 'Фильтры',
  BRAKES: 'Тормоза',
  TIRES: 'Шины',
  TIMING: 'ГРМ',
  INSPECTION: 'Диагностика',
  OTHER: 'Другое',
};

type TransitionFormAction = (formData: FormData) => void;

export type MaintenanceTransitionControls = {
  formAction: TransitionFormAction;
  pending: boolean;
};

export function formatMaintenanceDate(value: string | null) {
  if (!value) return 'Дата не указана';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatMaintenanceCost(value: number | null) {
  if (value === null) return 'Не указана';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function MaintenanceRecordActions({
  record,
  formAction,
  pending,
}: { record: MaintenanceRecordDto } & MaintenanceTransitionControls) {
  const canStart = record.status === 'PLANNED' || record.status === 'OVERDUE';
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
          {pending ? 'Обновляем…' : 'Начать работу'}
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
          {pending ? 'Обновляем…' : 'Завершить работу'}
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

export function MaintenanceRecordCard({
  record,
  formAction,
  pending,
  testId = 'maintenance-record',
}: MaintenanceTransitionControls & {
  record: MaintenanceRecordDto;
  testId?: string;
}) {
  const status = maintenanceStatusView[record.status];

  return (
    <Card className="min-w-0 p-4" data-testid={testId}>
      <article className="grid min-w-0 gap-4">
        <header className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-[var(--color-text-tertiary)]">
              {maintenanceKindLabels[record.kind]}
            </p>
            <h2 className="text-base font-bold break-words text-[var(--color-text)]">
              {record.title}
            </h2>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </header>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex min-w-0 gap-2">
            <FiMapPin aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
            <div className="min-w-0">
              <dt className="text-xs text-[var(--color-text-tertiary)]">Автомобиль</dt>
              <dd className="font-medium break-words">
                {record.vehicle.internalNumber} · {record.vehicle.model}
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
              <dd>{formatMaintenanceDate(record.scheduledAt)}</dd>
            </div>
          </div>
          <div className="flex min-w-0 gap-2">
            <FiClock aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
            <div>
              <dt className="text-xs text-[var(--color-text-tertiary)]">Пробег</dt>
              <dd>
                {record.targetOdometerKm === null
                  ? 'Не указан'
                  : `${new Intl.NumberFormat('ru-RU').format(record.targetOdometerKm)} км`}
              </dd>
            </div>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-text-tertiary)]">Стоимость</dt>
            <dd>{formatMaintenanceCost(record.costMinor)}</dd>
          </div>
        </dl>
        {record.provider || record.notes ? (
          <p className="text-sm break-words text-[var(--color-text-secondary)]">
            {[record.provider, record.notes].filter(Boolean).join(' · ')}
          </p>
        ) : null}
        <MaintenanceRecordActions record={record} formAction={formAction} pending={pending} />
      </article>
    </Card>
  );
}
