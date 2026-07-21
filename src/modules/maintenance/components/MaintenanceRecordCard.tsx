'use client';

import { useRef, useState } from 'react';
import {
  FiAlertTriangle,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiMapPin,
  FiPlay,
  FiSlash,
  FiTool,
  FiX,
} from 'react-icons/fi';

import type { MaintenanceKind, MaintenanceStatus } from '../types';
import type { MaintenanceRecordDto } from '../server/queries';
import { calculateMaintenanceOdometerProgress } from '../progress';
import { PILOT_BUSINESS_TIME_ZONE } from '@/shared/business-time';
import { Badge, Button, Card, ConfirmationDialog, Progress } from '@/shared/ui';

export const maintenanceStatusView: Record<
  MaintenanceStatus,
  {
    label: string;
    tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
    icon: React.ReactNode;
  }
> = {
  PLANNED: { label: 'Запланировано', tone: 'primary', icon: <FiCalendar aria-hidden="true" /> },
  IN_PROGRESS: { label: 'В работе', tone: 'warning', icon: <FiTool aria-hidden="true" /> },
  COMPLETED: { label: 'Завершено', tone: 'success', icon: <FiCheck aria-hidden="true" /> },
  OVERDUE: { label: 'Просрочено', tone: 'danger', icon: <FiAlertTriangle aria-hidden="true" /> },
  CANCELLED: { label: 'Отменено', tone: 'neutral', icon: <FiSlash aria-hidden="true" /> },
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
    timeZone: PILOT_BUSINESS_TIME_ZONE,
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
  const formRef = useRef<HTMLFormElement>(null);
  const cancelSubmitRef = useRef<HTMLButtonElement>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const canStart = record.status === 'PLANNED' || record.status === 'OVERDUE';
  const canComplete = record.status === 'IN_PROGRESS';
  const canCancel = canStart || canComplete;

  if (!canStart && !canComplete && !canCancel) return null;

  return (
    <>
      <form ref={formRef} action={formAction} className="flex min-w-0 flex-wrap gap-2">
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
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              leadingIcon={<FiX aria-hidden="true" />}
              onClick={() => setConfirmationOpen(true)}
            >
              Отменить
            </Button>
            <button
              ref={cancelSubmitRef}
              type="submit"
              name="toStatus"
              value="CANCELLED"
              hidden
              tabIndex={-1}
            />
          </>
        ) : null}
      </form>
      <ConfirmationDialog
        open={confirmationOpen}
        onOpenChange={setConfirmationOpen}
        title="Отменить ТО?"
        description="Запись будет отменена, и это действие нельзя будет вернуть."
        onConfirm={() => {
          setConfirmationOpen(false);
          formRef.current?.requestSubmit(cancelSubmitRef.current ?? undefined);
        }}
      >
        <Button type="button" variant="secondary" onClick={() => setConfirmationOpen(false)}>
          Не отменять
        </Button>
      </ConfirmationDialog>
    </>
  );
}

function formatOdometer(value: number | null) {
  return value === null ? 'Не указан' : `${new Intl.NumberFormat('ru-RU').format(value)} км`;
}

export function MaintenanceOdometerView({ record }: { record: MaintenanceRecordDto }) {
  const progress = calculateMaintenanceOdometerProgress({
    startOdometerKm: record.odometerKm,
    currentOdometerKm: record.currentOdometerKm,
    targetOdometerKm: record.targetOdometerKm,
  });

  return (
    <div className="grid min-w-48 gap-2 text-xs">
      <span>Старт: {formatOdometer(record.odometerKm)}</span>
      <span>Сейчас: {formatOdometer(record.currentOdometerKm)}</span>
      <span>Цель: {formatOdometer(record.targetOdometerKm)}</span>
      {progress.remainingKm !== null ? (
        <strong className="text-[var(--color-text)]">
          Осталось: {formatOdometer(progress.remainingKm)}
        </strong>
      ) : null}
      {progress.progressPercent !== null ? (
        <Progress value={progress.progressPercent} label="Прогресс до ТО" />
      ) : null}
    </div>
  );
}

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  const view = maintenanceStatusView[status];
  return (
    <Badge tone={view.tone} className="gap-1.5">
      {view.icon}
      {view.label}
    </Badge>
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
          <MaintenanceStatusBadge status={record.status} />
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
                <MaintenanceOdometerView record={record} />
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
