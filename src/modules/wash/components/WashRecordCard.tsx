'use client';

import { useRef, useState } from 'react';
import {
  FiAlertCircle,
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

import type { VehicleCleanlinessStatus } from '../cleanliness';
import type { WashRecordDto } from '../server/queries';
import type { WashKind, WashStatus } from '../types';
import { PILOT_BUSINESS_TIME_ZONE } from '@/shared/business-time';
import { Badge, Button, Card, ConfirmationDialog } from '@/shared/ui';

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
  transitionPending: boolean;
  pendingTransition: { recordId: string; toStatus: WashStatus } | null;
  onTransitionIntent: (transition: { recordId: string; toStatus: WashStatus }) => void;
};

export function formatWashDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: PILOT_BUSINESS_TIME_ZONE,
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

export function CleanlinessBadge({ status }: { status: VehicleCleanlinessStatus }) {
  const view =
    status === 'CLEAN'
      ? {
          label: 'Чистый',
          tone: 'success' as const,
          icon: <FiCheckCircle aria-hidden="true" />,
        }
      : {
          label: 'Требует мойки',
          tone: 'warning' as const,
          icon: <FiAlertCircle aria-hidden="true" />,
        };

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
  transitionPending,
  pendingTransition,
  onTransitionIntent,
}: { record: WashRecordDto } & WashTransitionControls) {
  const formRef = useRef<HTMLFormElement>(null);
  const cancelSubmitRef = useRef<HTMLButtonElement>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const canStart = record.status === 'PLANNED';
  const canComplete = record.status === 'IN_PROGRESS';
  const canCancel = canStart || canComplete;
  const isPending = (toStatus: WashStatus) =>
    transitionPending &&
    pendingTransition?.recordId === record.id &&
    pendingTransition.toStatus === toStatus;

  if (!canStart && !canComplete && !canCancel) return null;

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="flex min-w-0 flex-wrap gap-2"
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          if (!(submitter instanceof HTMLButtonElement)) return;
          onTransitionIntent({
            recordId: record.id,
            toStatus: submitter.value as WashStatus,
          });
        }}
      >
        <input type="hidden" name="recordId" value={record.id} />
        <input type="hidden" name="fromStatus" value={record.status} />
        {canStart ? (
          <Button
            type="submit"
            name="toStatus"
            value="IN_PROGRESS"
            size="sm"
            loading={isPending('IN_PROGRESS')}
            disabled={transitionPending && !isPending('IN_PROGRESS')}
            leadingIcon={<FiPlay aria-hidden="true" />}
          >
            {isPending('IN_PROGRESS') ? 'Обновляем…' : 'Начать мойку'}
          </Button>
        ) : null}
        {canComplete ? (
          <Button
            type="submit"
            name="toStatus"
            value="COMPLETED"
            size="sm"
            loading={isPending('COMPLETED')}
            disabled={transitionPending && !isPending('COMPLETED')}
            leadingIcon={<FiCheckCircle aria-hidden="true" />}
          >
            {isPending('COMPLETED') ? 'Обновляем…' : 'Завершить мойку'}
          </Button>
        ) : null}
        {canCancel ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={isPending('CANCELLED')}
              disabled={transitionPending && !isPending('CANCELLED')}
              leadingIcon={<FiX aria-hidden="true" />}
              onClick={() => setConfirmationOpen(true)}
            >
              {isPending('CANCELLED') ? 'Отменяем…' : 'Отменить'}
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
        title="Отменить мойку?"
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

export function WashRecordCard({
  record,
  formAction,
  transitionPending,
  pendingTransition,
  onTransitionIntent,
  cleanliness,
  testId = 'wash-record',
}: WashTransitionControls & {
  record: WashRecordDto;
  cleanliness: VehicleCleanlinessStatus;
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
          <span className="flex flex-wrap justify-end gap-2">
            <WashStatusBadge status={record.status} />
            <CleanlinessBadge status={cleanliness} />
          </span>
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
        <WashRecordActions
          record={record}
          formAction={formAction}
          transitionPending={transitionPending}
          pendingTransition={pendingTransition}
          onTransitionIntent={onTransitionIntent}
        />
      </article>
    </Card>
  );
}
