'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  FiCalendar,
  FiClock,
  FiCopy,
  FiDownload,
  FiMapPin,
  FiUser,
  FiCheckCircle,
  FiCamera,
} from 'react-icons/fi';
import { TbCar } from 'react-icons/tb';
import { Badge, Button, Card, Modal } from '@/shared/ui';
import type { FineItem } from './FinesPage';
import { FineAssignmentReview } from './FineAssignmentReview';
import { discountBadge } from './fine-card-presentation';

function amount(value: string) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: Number(BigInt(value) % BigInt(100)) ? 2 : 0,
  }).format(Number(value) / 100);
}
function date(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}
const statuses = {
  NEW: 'Не оплачен',
  UNPAID: 'Не оплачен',
  OVERDUE: 'Просрочен',
  PAID: 'Оплачен',
  CANCELLED: 'Отменён',
};

export function FineCard({
  fine,
  referenceTime,
  canManage,
  canPay,
  selected,
  onToggle,
  onPay,
  onCopy,
  copyFeedback,
}: {
  fine: FineItem;
  referenceTime: string;
  canManage: boolean;
  canPay: boolean;
  selected: boolean;
  onToggle: () => void;
  onPay: () => void;
  onCopy: () => void;
  copyFeedback?: string;
}) {
  const [dialog, setDialog] = useState<'driver' | 'place' | null>(null);
  const parts = fine.vehicleLabel.split(' · ');
  const plate = parts.length > 1 ? parts.pop() : null;
  const paid = fine.status === 'PAID';
  const closed = paid || fine.status === 'CANCELLED';
  const discount = discountBadge(fine, referenceTime);
  const confirmed = Boolean(fine.clientLabel && fine.assignmentConfirmedAt);
  const iconClass = 'size-4 shrink-0 text-[var(--color-text-secondary)]';
  return (
    <Card
      id={`fine-${fine.id}`}
      data-testid="fine-card"
      className="@container min-w-0 scroll-mt-24 overflow-hidden target:ring-2 target:ring-[var(--color-primary)]"
    >
      <header
        className={`space-y-3 p-4 ${paid ? 'bg-[var(--color-success-soft)]' : closed ? 'bg-[var(--color-elevated)]' : 'bg-[var(--color-danger-soft)]'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm leading-5 font-semibold">{fine.description || 'Нарушение ПДД'}</h2>
          <Badge
            data-testid="fine-status-badge"
            tone={paid ? 'success' : closed ? 'neutral' : 'danger'}
            className={`inline-flex min-h-7 shrink-0 items-center justify-center px-3 py-1 text-center leading-5 ${paid ? '!bg-[color-mix(in_srgb,var(--color-success)_12%,var(--color-success-soft))]' : !closed ? '!bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-danger-soft))]' : ''}`}
          >
            {statuses[fine.status]}
          </Badge>
        </div>
        <div className="flex flex-wrap items-baseline gap-3">
          <strong className="text-3xl font-semibold tracking-tight tabular-nums">
            {amount(fine.currentAmountMinor)}
          </strong>
          {fine.currentAmountMinor !== fine.originalAmountMinor ? (
            <del className="text-sm text-[var(--color-text-secondary)]">
              {amount(fine.originalAmountMinor)}
            </del>
          ) : null}
        </div>
        {discount ? (
          <div data-testid="fine-discount-strip" className="text-xs text-[var(--color-danger)]">
            Скидка до {date(fine.discountExpiresAt!)}
          </div>
        ) : null}
        {fine.status === 'NEW' || fine.repeatedOffense || fine.toBailiff ? (
          <div className="flex flex-wrap gap-2">
            {fine.status === 'NEW' ? <Badge tone="primary">Новый</Badge> : null}
            {fine.repeatedOffense ? <Badge tone="primary">Повторный</Badge> : null}
            {fine.toBailiff ? <Badge tone="danger">Передача приставам</Badge> : null}
          </div>
        ) : null}
      </header>
      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <TbCar aria-hidden="true" className="mt-1 size-5 shrink-0 text-[var(--color-primary)]" />
          <div className="min-w-0">
            <p className="text-base font-semibold break-words">
              {parts.join(' ') || 'Автомобиль не привязан'}
            </p>
            {plate ? (
              <span className="mt-1 inline-block rounded-md bg-[var(--color-elevated)] px-2 py-1 text-sm font-semibold tabular-nums">
                {plate}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex gap-3 rounded-xl bg-[var(--color-elevated)] p-3">
          <FiUser aria-hidden="true" className={`${iconClass} mt-1`} />
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-[var(--color-text-secondary)]">Водитель</p>
            <p className="flex items-center gap-2 text-sm font-semibold break-words">
              {fine.clientLabel || 'Не привязан'}
              {confirmed ? (
                <FiCheckCircle
                  aria-label="Подтверждено менеджером"
                  className="size-4 shrink-0 text-[var(--color-success)]"
                />
              ) : null}
            </p>
            {confirmed ? (
              <p className="text-xs text-[var(--color-text-secondary)]">Подтверждено менеджером</p>
            ) : fine.clientLabel ? (
              <p className="text-xs text-[var(--color-text-secondary)]">
                Требуется подтверждение менеджера
              </p>
            ) : null}
            {fine.rentalLabel ? (
              <p className="text-xs text-[var(--color-primary)]">
                {fine.rentalId ? (
                  <Link href={`/rentals/${fine.rentalId}`}>Аренда {fine.rentalLabel}</Link>
                ) : (
                  `Аренда ${fine.rentalLabel}`
                )}
              </p>
            ) : null}
          </div>
        </div>
        <div className="border-t pt-3">
          <p className="text-xs text-[var(--color-text-secondary)]">Постановление</p>
          <div className="flex items-center gap-1">
            <span className="min-w-0 text-sm font-semibold break-all tabular-nums">
              № {fine.decreeNumber}
            </span>
            <button
              type="button"
              aria-label="Скопировать номер постановления"
              onClick={onCopy}
              className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-[var(--color-elevated)]"
            >
              <FiCopy aria-hidden="true" />
            </button>
            {fine.photoAvailable ? (
              <a
                href={`/fines/${fine.id}/photo?download=1`}
                download
                aria-label="Скачать фото постановления"
                className="grid size-11 shrink-0 place-items-center rounded-lg text-[var(--color-primary)] hover:bg-[var(--color-elevated)]"
              >
                <FiDownload aria-hidden="true" />
              </a>
            ) : null}
          </div>
          {copyFeedback ? (
            <p role="status" className="text-xs">
              {copyFeedback}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-3 text-sm @[380px]:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-[var(--color-text-secondary)]">Дата нарушения</p>
            <p
              data-testid="fine-offense-datetime"
              className="flex flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <FiCalendar className={iconClass} aria-hidden="true" />
                {date(fine.offenseAt)}
              </span>
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <FiClock className={iconClass} aria-hidden="true" />
                {new Intl.DateTimeFormat('ru-RU', {
                  timeZone: 'Europe/Moscow',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(fine.offenseAt))}
              </span>
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-[var(--color-text-secondary)]">Дата постановления</p>
            <p className="flex items-center gap-2">
              <FiCalendar className={iconClass} aria-hidden="true" />
              {fine.decreeAt ? date(fine.decreeAt) : 'Не указана'}
            </p>
          </div>
        </div>
        <div data-testid="fine-offense-address" className="flex gap-2">
          <FiMapPin className={`${iconClass} mt-1`} aria-hidden="true" />
          <div>
            <p className="text-xs text-[var(--color-text-secondary)]">Место нарушения</p>
            <p className="mt-1 text-sm break-words">
              {fine.address?.trim() || 'Не указано в постановлении'}
            </p>
          </div>
        </div>
        {fine.comment ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{fine.comment}</p>
        ) : null}
        <div className="grid grid-cols-2 gap-2 border-t pt-3">
          <Button
            variant="outline"
            onClick={() => setDialog('place')}
            leadingIcon={<FiMapPin aria-hidden="true" />}
          >
            Место нарушения
          </Button>
          <Button
            variant="outline"
            onClick={() => setDialog('driver')}
            leadingIcon={<FiUser aria-hidden="true" />}
          >
            {fine.clientLabel ? 'Водитель' : 'Привязать'}
          </Button>
        </div>
        {fine.photoAvailable ? (
          <Link
            className="flex min-h-11 items-center justify-center gap-2 text-sm text-[var(--color-primary)]"
            href={`/fines/${fine.id}/photo`}
          >
            <FiCamera aria-hidden="true" />
            Посмотреть фото
          </Link>
        ) : null}
        {canPay && !closed ? (
          <div className="space-y-2">
            <Button className="w-full" onClick={onPay}>
              Оплатить штраф
            </Button>
            <label className="flex min-h-11 items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggle}
                aria-label={`Выбрать для оплаты постановление ${fine.decreeNumber}`}
                className="size-4 accent-[var(--color-primary)]"
              />
              Выбрать для общей оплаты
            </label>
          </div>
        ) : null}
      </div>
      <Modal
        open={dialog === 'driver'}
        onOpenChange={() => setDialog(null)}
        title="Водитель и привязка штрафа"
        className="max-h-[85dvh] overflow-y-auto"
        backdropClassName="!z-[120]"
        footer={
          <Button variant="outline" onClick={() => setDialog(null)}>
            Закрыть
          </Button>
        }
      >
        {fine.companyId ? (
          <FineAssignmentReview
            companyId={fine.companyId}
            fineId={fine.id}
            canManage={canManage}
            confirmedClientLabel={confirmed ? fine.clientLabel : null}
            confirmedContractLabel={fine.rentalLabel}
            candidates={fine.assignmentCandidates ?? []}
          />
        ) : (
          <p>{fine.clientLabel || 'Подходящие аренды не найдены.'}</p>
        )}
      </Modal>
      <Modal
        open={dialog === 'place'}
        onOpenChange={() => setDialog(null)}
        title="Место нарушения"
        className="max-h-[85dvh] overflow-y-auto"
        backdropClassName="!z-[120]"
        footer={
          <Button variant="outline" onClick={() => setDialog(null)}>
            Закрыть
          </Button>
        }
      >
        <p className="mb-4">{fine.address || 'Адрес не предоставлен источником'}</p>
        {fine.address ? (
          <a
            className="text-[var(--color-primary)] underline"
            href={`https://yandex.ru/maps/?text=${encodeURIComponent(fine.address)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Показать на Яндекс Картах
          </a>
        ) : null}
      </Modal>
    </Card>
  );
}
