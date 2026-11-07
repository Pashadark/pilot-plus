'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/shared/ui/Overlays';
import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiFileText,
  FiClock,
  FiMapPin,
  FiSearch,
  FiSend,
  FiSliders,
  FiRefreshCw,
  FiUser,
} from 'react-icons/fi';
import { deadlineWeek } from '../deadline-queue';
import { DeadlineTable } from './DeadlineTable';
import styles from './deadline-workspace.module.css';

import { syncFinesAction } from '../server/sync-action';
import { Badge, Button, Card, CardContent } from '@/shared/ui';
import { getVehiclePromoForFine } from '@/modules/dashboard/vehicle-promo';

import { type FineAssignmentCandidate } from './FineAssignmentReview';
import { FinePaymentPanel } from './FinePaymentPanel';
import { discountBadge } from './fine-card-presentation';
import { FineCard } from './FineCard';
import { ViolationIconPng } from './ViolationIconPng';

export interface FineItem {
  kind?: 'TOLL';
  roadLabel?: string;
  rentalId?: string | null;
  checkedAt?: string | null;
  id: string;
  companyId?: string;
  vehicleId?: string | null;
  decreeNumber: string;
  decreeAt?: string | null;
  assignmentConfirmedAt?: string | null;
  offenseAt: string;
  currentAmountMinor: string;
  originalAmountMinor: string;
  status: 'NEW' | 'UNPAID' | 'PAID' | 'CANCELLED' | 'OVERDUE' | 'ARCHIVED';
  archivedAt?: string | null;
  description: string | null;
  address: string | null;
  comment?: string | null;
  vehicleLabel: string;
  clientLabel: string | null;
  rentalLabel?: string | null;
  photoAvailable: boolean;
  assigned?: boolean;
  assignmentCandidates?: readonly FineAssignmentCandidate[];
  discountExpiresAt?: string | null;
  toBailiff?: boolean;
  repeatedOffense?: boolean;
}

export interface FineFilters {
  status?: string;
  query?: string;
  companyId?: string;
  offenseFrom?: string;
  offenseTo?: string;
  vehicleId?: string;
  clientId?: string;
  pageSize?: string;
  discountDay?: string;
}

interface FinesPageProps {
  referenceTime?: string;
  deadlineDays?: { day: string; count: number; amountMinor: string }[];
  summary: {
    newCount: number;
    newAmountMinor?: string;
    unpaidCount: number;
    unpaidAmountMinor: string;
    unassignedCount: number;
    unassignedAmountMinor?: string;
    urgentCount?: number;
    urgentAmountMinor?: string;
    discountEndingSoonCount?: number;
    bailiffRiskCount?: number;
    tollCount?: number;
    tollAmountMinor?: string;
  };
  fines: readonly FineItem[];
  companies: readonly { id: string; name: string }[];
  vehicles?: readonly { id: string; label: string }[];
  clients?: readonly { id: string; label: string }[];
  selectedCompanyId?: string;
  canSync: boolean;
  canManage?: boolean;
  canPay?: boolean;
  filters?: FineFilters;
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  syncOutcome?: 'success' | 'error';
  paymentOutcome?: 'returned' | 'failed' | 'invalid';
  tollsUnavailable?: boolean;
}

const statusPresentation = {
  NEW: { label: 'Новый' },
  UNPAID: { label: 'Не оплачен' },
  PAID: { label: 'Оплачен' },
  CANCELLED: { label: 'Отменён' },
  OVERDUE: { label: 'Просрочен' },
  ARCHIVED: { label: 'Архив' },
} as const;

function money(minor: string) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: Number(BigInt(minor) % BigInt(100) !== BigInt(0)) ? 2 : 0,
  }).format(Number(BigInt(minor)) / 100);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  }).format(new Date(value));
}
function payable(fine: FineItem) {
  return (
    fine.kind !== 'TOLL' &&
    fine.status !== 'PAID' &&
    fine.status !== 'CANCELLED' &&
    fine.status !== 'ARCHIVED'
  );
}
function filterUrl(filters: FineFilters, page: number) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/fines?${query}` : '/fines';
}

function exportUrl(filters: FineFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `/fines/export.xlsx?${query}` : '/fines/export.xlsx';
}

function TollDebtDetails({ fine }: { fine: FineItem }) {
  return (
    <Card className="min-w-0" data-testid="toll-debt-card">
      <CardContent className="space-y-4 !p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="primary">{fine.roadLabel}</Badge>
          <Badge tone="neutral">Платная дорога</Badge>
          <Badge tone="warning">Не оплачен</Badge>
        </div>
        <div>
          <h2 className="text-base leading-6 font-semibold">{fine.vehicleLabel}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{fine.description}</p>
        </div>
        <strong className="block text-2xl font-semibold tabular-nums">
          {money(fine.currentAmountMinor)}
        </strong>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-[var(--color-border)] pt-3 text-xs">
          <dt className="text-[var(--color-text-secondary)]">Арендатор</dt>
          <dd className="break-words">{fine.clientLabel ?? 'Не определён'}</dd>
          <dt className="text-[var(--color-text-secondary)]">Проезд</dt>
          <dd>{formatDate(fine.offenseAt)}</dd>
          <dt className="text-[var(--color-text-secondary)]">Договор</dt>
          <dd>
            {fine.rentalId ? (
              <Link className="text-[var(--color-primary)] hover:underline" href={`/rentals/${fine.rentalId}`}>
                {fine.rentalLabel}
              </Link>
            ) : (
              'Не найден однозначно'
            )}
          </dd>
        </dl>
        {fine.checkedAt ? (
          <p className="text-xs text-[var(--color-text-tertiary)]">Проверено {formatDate(fine.checkedAt)}</p>
        ) : null}
        {fine.rentalId ? (
          <Link
            className="flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm font-medium text-[var(--color-primary)]"
            href={`/rentals/${fine.rentalId}`}
          >
            Открыть аренду
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FineStatus({ fine }: { fine: FineItem }) {
  if (fine.kind === 'TOLL') return <Badge tone="warning">К оплате</Badge>;
  const tone =
    fine.status === 'PAID'
      ? 'success'
      : fine.status === 'CANCELLED' || fine.status === 'ARCHIVED'
        ? 'neutral'
        : fine.status === 'NEW'
          ? 'primary'
          : 'danger';
  return <Badge tone={tone}>{statusPresentation[fine.status].label}</Badge>;
}

function discountDeadline(fine: FineItem, referenceTime: string) {
  const discount = discountBadge(fine, referenceTime);
  if (!discount || !fine.discountExpiresAt) return null;
  const hours = Math.max(0, Math.ceil((discount.expires - Date.parse(referenceTime)) / (60 * 60 * 1000)));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return {
    date: formatDate(fine.discountExpiresAt),
    remaining: days ? `${days} д ${remainingHours} ч` : `${remainingHours} ч`,
    urgent: hours <= 72,
  };
}

function FineDetailModalContent({
  fine,
  referenceTime,
  canPay,
  onPay,
}: {
  fine: FineItem;
  referenceTime: string;
  canPay: boolean;
  onPay: () => void;
}) {
  const promo = getVehiclePromoForFine(fine.vehicleId, fine.vehicleLabel);
  const deadline = discountDeadline(fine, referenceTime);
  const [model, plate] = fine.vehicleLabel.split(' · ');
  const closed =
    fine.status === 'PAID' || fine.status === 'CANCELLED' || fine.status === 'ARCHIVED';

  return (
    <div data-testid="fine-detail-modal-content" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div className="flex min-w-0 items-center gap-3">
          {promo ? <Image src={promo.localPath} alt={promo.alt} width={138} height={88} className="h-20 w-32 shrink-0 object-contain" /> : <FiFileText className="size-12 text-[var(--color-text-secondary)]" aria-hidden />}
          <div className="min-w-0">
            <p className="text-base font-semibold">{model || 'Автомобиль не привязан'}</p>
            {plate ? <p className="mt-1 text-sm font-medium tabular-nums text-[var(--color-text-secondary)]">{plate}</p> : null}
          </div>
        </div>
        <FineStatus fine={fine} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {deadline ? (
          <div className={`rounded-[var(--radius-md)] border p-4 ${deadline.urgent ? 'border-[color-mix(in_srgb,var(--color-danger)_55%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))]' : 'border-[var(--color-warning)] bg-[var(--color-warning-soft)]'}`}>
            <div className="flex gap-3">
              <FiClock className="mt-0.5 size-5 shrink-0 text-[var(--color-warning)]" aria-hidden />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Оплатить до</p>
                <p className="mt-1 font-bold tabular-nums">{deadline.date}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--color-warning)]">Осталось {deadline.remaining}</p>
              </div>
            </div>
          </div>
        ) : <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)]">Для этого начисления скидка не применяется.</div>}

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Сумма к оплате</p>
          <strong className="mt-1 block text-2xl tabular-nums">{money(fine.currentAmountMinor)}</strong>
          {fine.currentAmountMinor !== fine.originalAmountMinor ? <del className="mt-1 block text-sm tabular-nums text-[var(--color-text-secondary)]">Полная сумма {money(fine.originalAmountMinor)}</del> : null}
          {fine.status === 'ARCHIVED' && fine.archivedAt ? <p className="mt-2 text-xs text-[var(--color-text-secondary)]">В архиве с {formatDate(fine.archivedAt)}</p> : null}
        </div>
      </div>

      <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
        <p className="text-xs font-semibold tracking-wide text-[var(--color-text-secondary)] uppercase">Нарушение</p>
        <div className="mt-3 flex items-start gap-3">
          <ViolationIconPng description={fine.description} kind={fine.kind} />
          <div className="min-w-0">
            <p className="font-semibold">{fine.description || fine.roadLabel || 'Нарушение ПДД'}</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatDate(fine.offenseAt)}</p>
          </div>
        </div>
      </section>

      <dl className="grid gap-4 border-y border-[var(--color-border)] py-4 text-sm sm:grid-cols-2">
        <div className="flex gap-3"><FiUser className="mt-0.5 shrink-0 text-[var(--color-text-secondary)]" aria-hidden /><div><dt className="text-xs text-[var(--color-text-secondary)]">Водитель</dt><dd className="mt-0.5 font-semibold">{fine.clientLabel ?? 'Не привязан'}</dd></div></div>
        <div className="flex gap-3"><FiFileText className="mt-0.5 shrink-0 text-[var(--color-text-secondary)]" aria-hidden /><div><dt className="text-xs text-[var(--color-text-secondary)]">Договор аренды</dt><dd className="mt-0.5 font-semibold">{fine.rentalLabel ?? 'Не найден'}</dd></div></div>
        <div className="flex gap-3 sm:col-span-2"><FiMapPin className="mt-0.5 shrink-0 text-[var(--color-text-secondary)]" aria-hidden /><div><dt className="text-xs text-[var(--color-text-secondary)]">Место нарушения</dt><dd className="mt-0.5">{fine.address ?? 'Не указано в постановлении'}</dd></div></div>
        {fine.kind !== 'TOLL' ? <div className="sm:col-span-2"><dt className="text-xs text-[var(--color-text-secondary)]">Постановление</dt><dd className="mt-0.5 font-medium break-all tabular-nums">№ {fine.decreeNumber || 'Не указано'}</dd></div> : null}
      </dl>

      <div className="grid gap-2 sm:grid-cols-3">
        {fine.photoAvailable ? <Link href={`/fines/${fine.id}/photo`} className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-elevated)]">Постановление и фото</Link> : null}
        {canPay && !closed ? <Button className="w-full" onClick={onPay}>Оплатить штраф</Button> : null}
        <button type="button" disabled title="Отправка станет доступна после подключения Telegram клиента" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text-secondary)] disabled:cursor-not-allowed disabled:opacity-55"><FiSend aria-hidden /> Отправить в Telegram</button>
      </div>
    </div>
  );
}

export function FinesPage({
  referenceTime,
  deadlineDays,
  summary,
  fines,
  companies,
  vehicles = [],
  clients = [],
  selectedCompanyId,
  canSync,
  canManage = false,
  canPay = false,
  filters = {},
  pagination,
  syncOutcome,
  paymentOutcome,
  tollsUnavailable,
}: FinesPageProps) {
  const [renderTime] = useState(() => referenceTime ?? new Date().toISOString());
  const orderedFines = useMemo(
    () =>
      [...fines].sort(
        (a, b) =>
          (discountBadge(a, renderTime)?.expires ?? Infinity) -
          (discountBadge(b, renderTime)?.expires ?? Infinity),
      ),
    [fines, renderTime],
  );
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [paymentFine, setPaymentFine] = useState<FineItem | null>(null);
  const [activeFine, setActiveFine] = useState<FineItem | null>(null);
  const [listKind, setListKind] = useState<'ALL' | 'FINE' | 'TOLL'>('ALL');
  const [listOrder, setListOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST');
  const [copyFeedback, setCopyFeedback] = useState<{ id: string; text: string } | null>(null);
  const copyDecree = async (fine: FineItem) => {
    try {
      await navigator.clipboard.writeText(fine.decreeNumber);
      setCopyFeedback({ id: fine.id, text: 'Номер скопирован' });
    } catch {
      setCopyFeedback({
        id: fine.id,
        text: 'Не удалось скопировать. Выделите полный номер в карточке.',
      });
    }
  };
  const selectedFines = useMemo(
    () => fines.filter((fine) => selectedIds.includes(fine.id) && payable(fine)),
    [fines, selectedIds],
  );
  const toggleFine = (fineId: string) =>
    setSelectedIds((ids) =>
      ids.includes(fineId) ? ids.filter((id) => id !== fineId) : [...ids, fineId],
    );
  const advancedFilterCount = [
    filters.offenseFrom,
    filters.offenseTo,
    filters.vehicleId,
    filters.clientId,
  ].filter(Boolean).length;
  const remainingFines = orderedFines;
  const days = deadlineDays ?? deadlineWeek(fines, renderTime);
  const remainingFineCount = remainingFines.filter((fine) => fine.kind !== 'TOLL').length;
  const remainingTollCount = remainingFines.length - remainingFineCount;
  const visibleRemainingFines = [...remainingFines]
    .filter((fine) => listKind === 'ALL' || (listKind === 'TOLL' ? fine.kind === 'TOLL' : fine.kind !== 'TOLL'))
    .sort((a, b) =>
      listOrder === 'NEWEST'
        ? Date.parse(b.offenseAt) - Date.parse(a.offenseAt)
        : Date.parse(a.offenseAt) - Date.parse(b.offenseAt),
    );
  const effectiveFilters = { ...filters, companyId: selectedCompanyId ?? filters.companyId };

  const [showFilters, setShowFilters] = useState(false);
  return (
    <div className={`flex flex-col ${styles.workspace}`}>
      <div className={styles.heading}>
        <h1>Штрафы</h1>
        <form action="/fines" method="get" className={styles.toolbar}>
          {Object.entries(effectiveFilters).filter(([key, value]) => key !== 'query' && value).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
          <label className={styles.search}><FiSearch aria-hidden/><span className="sr-only">Поиск по всем штрафам и платным дорогам</span><input name="query" defaultValue={filters.query ?? ''} placeholder="Поиск по номеру, водителю, нарушению…" /></label>
          <button type="submit" className="sr-only">Найти</button>
          <button type="button" className={styles.action} aria-expanded={showFilters} onClick={() => setShowFilters(value => !value)}><FiSliders aria-hidden/>Фильтры</button>
          <Link href={exportUrl(effectiveFilters)} className={styles.action} data-primary="true"><FiDownload aria-hidden/>Экспорт в Excel</Link>
        </form>
      </div>
      {tollsUnavailable ? (
        <p
          role="status"
          className="rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] p-3 text-sm text-[var(--color-warning)]"
        >
          Не удалось загрузить все проезды по платным дорогам. Список и сумма могут быть неполными.
          Обновите страницу.
        </p>
      ) : null}
      {paymentOutcome === 'returned' ? (
        <div
          role="status"
          className="rounded-[var(--radius-md)] border border-blue-300 bg-blue-50 p-4 text-sm text-blue-900"
        >
          <strong>Возврат из тестовой платёжной страницы получен.</strong> Оплата не подтверждена:
          Driver Helper не проверяет sandbox-платёж, штраф остаётся неоплаченным.
        </div>
      ) : null}
      {syncOutcome ? (
        <div
          role="status"
          className={`rounded-[var(--radius-md)] border p-4 text-sm font-medium ${syncOutcome === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800'}`}
        >
          {syncOutcome === 'success'
            ? 'Штрафы и автомобили обновлены из Driver Helper.'
            : 'Не удалось обновить Driver Helper. Проверьте доступ к сервису и повторите.'}
        </div>
      ) : null}
      <Card hidden={!showFilters} className="!border-[var(--color-border)] !bg-[var(--color-surface)]">
        <CardContent>
          <form action="/fines" method="get" className="grid min-w-0 gap-3">
            {selectedCompanyId && companies.length <= 1 ? (
              <input type="hidden" name="companyId" value={selectedCompanyId} />
            ) : null}
            {pagination ? <input type="hidden" name="pageSize" value={pagination.pageSize} /> : null}
            <div className="flex min-w-0 flex-col gap-2 md:flex-row">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Уточнить поиск</span>
                <FiSearch aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                <input
                  name="query"
                  defaultValue={filters.query ?? ''}
                  placeholder="Машина, госномер, клиент, договор, постановление, платная дорога или дата"
                  className="min-h-14 w-full rounded-[1rem] border border-[var(--color-border)] bg-[var(--color-elevated)] pr-4 pl-12 text-base outline-none focus:border-[var(--color-primary)]"
                />
              </label>
              <Button type="submit" size="lg">Найти</Button>
              <Link href={exportUrl(effectiveFilters)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-elevated)]">
                <FiDownload aria-hidden /> Скачать Excel
              </Link>
            </div>
            <details
              data-testid="fine-advanced-filters"
              open={advancedFilterCount > 0 || undefined}
              className="group"
            >
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-sm)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
                <FiSliders aria-hidden />
                <span>Фильтры{advancedFilterCount ? ` · ${advancedFilterCount}` : ''}</span>
                <FiChevronDown aria-hidden className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 grid min-w-0 gap-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-2 xl:grid-cols-5 xl:items-end">
                {companies.length > 1 ? (
                  <label className="grid min-w-0 gap-1.5" htmlFor="fine-company">
                    <span className="text-sm font-medium">Фирма</span>
                    <select id="fine-company" name="companyId" defaultValue={selectedCompanyId ?? ''} className="min-h-11 min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3">
                      <option value="">Все доступные фирмы</option>
                      {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                    </select>
                  </label>
                ) : null}
                <label className="grid min-w-0 gap-1.5">
                  <span className="text-sm font-medium">Статус</span>
                  <select name="status" defaultValue={filters.status ?? ''} className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3">
                    <option value="">Все статусы</option>
                    {Object.entries(statusPresentation).map(([value, presentation]) => <option key={value} value={value}>{presentation.label}</option>)}
                  </select>
                </label>
                <label className="grid min-w-0 gap-1.5">
                  <span className="text-sm font-medium">Нарушение с</span>
                  <input
                    type="date"
                    name="offenseFrom"
                    defaultValue={filters.offenseFrom ?? ''}
                    className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
                  />
                </label>
                <label className="grid min-w-0 gap-1.5">
                  <span className="text-sm font-medium">Нарушение по</span>
                  <input
                    type="date"
                    name="offenseTo"
                    defaultValue={filters.offenseTo ?? ''}
                    className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
                  />
                </label>
                <label className="grid min-w-0 gap-1.5">
                  <span className="text-sm font-medium">Автомобиль</span>
                  <select
                    name="vehicleId"
                    defaultValue={filters.vehicleId ?? ''}
                    className="min-h-11 min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
                  >
                    <option value="">Все автомобили</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid min-w-0 gap-1.5">
                  <span className="text-sm font-medium">Клиент</span>
                  <select
                    name="clientId"
                    defaultValue={filters.clientId ?? ''}
                    className="min-h-11 min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
                  >
                    <option value="">Все клиенты</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
          </form>
          {canSync && selectedCompanyId ? (
            <form action={syncFinesAction} className="mt-4">
              <input type="hidden" name="companyId" value={selectedCompanyId} />
              <Button type="submit" variant="secondary" leadingIcon={<FiRefreshCw aria-hidden="true" />}>
                Обновить штрафы
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
      <section aria-label="Сроки скидок на ближайшие семь дней" className={styles.week}>
        {days.map(day => <Link key={day.day} href={filterUrl({ ...effectiveFilters, discountDay: filters.discountDay === day.day ? undefined : day.day }, 1)} className={styles.day} data-active={filters.discountDay === day.day} aria-label={`Срок скидки ${day.day}: ${day.count}, ${money(day.amountMinor)}`}>
          <small>{new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'Europe/Moscow' }).format(new Date(day.day + 'T12:00:00Z'))}</small>
          <strong>{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' }).format(new Date(day.day + 'T12:00:00Z'))}</strong>
          <small>Штрафов: {day.count}</small><strong>{money(day.amountMinor)}</strong>
        </Link>)}
      </section>
      {canPay && selectedCompanyId && selectedFines.length ? <FinePaymentPanel companyId={selectedCompanyId} selectedFines={selectedFines} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="text-xs text-[var(--color-text-secondary)]">Не оплачено: {summary.unpaidCount} · {money(summary.unpaidAmountMinor)}{filters.discountDay ? <Link className="ml-3 text-[var(--color-primary)]" href={filterUrl({ ...effectiveFilters, discountDay: undefined }, 1)}>Сбросить дату</Link> : null}</div>
        <div className="flex flex-wrap items-center gap-1 text-sm">
          {([
            ['ALL', `Все ${remainingFines.length}`],
            ['FINE', `Штрафы ${remainingFineCount}`],
            ['TOLL', `Платные дороги ${remainingTollCount}`],
          ] as const).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              onClick={() => setListKind(kind)}
              data-active={listKind === kind}
              className="min-h-10 rounded-lg px-3 font-semibold text-[var(--color-text-secondary)] data-[active=true]:bg-[var(--color-primary-soft)] data-[active=true]:text-[var(--color-primary)]"
            >
              {label}
            </button>
          ))}
          <label className="ml-2">
            <span className="sr-only">Сортировка</span>
            <select
              value={listOrder}
              onChange={(event) => setListOrder(event.target.value as 'NEWEST' | 'OLDEST')}
              className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-semibold"
            >
              <option value="NEWEST">Сначала новые</option>
              <option value="OLDEST">Сначала старые</option>
            </select>
          </label>
        </div>
      </div>
      {remainingFines.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-[var(--color-text-secondary)]">
            Штрафы по этим фильтрам не найдены.
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-label="Таблица штрафов и платных дорог" className="hidden min-w-0 lg:block">
            <DeadlineTable fines={visibleRemainingFines} now={renderTime} onOpen={setActiveFine} selectedIds={selectedIds} onToggle={toggleFine} canSelect={Boolean(canPay && selectedCompanyId)} />
          </section>
          <section aria-label="Список штрафов" className="grid min-w-0 items-start gap-4 md:grid-cols-2 lg:hidden">
            {visibleRemainingFines.map((fine) =>
              fine.kind === 'TOLL' ? (
                <TollDebtDetails key={fine.id} fine={fine} />
              ) : (
                <FineCard
                  key={fine.id}
                  fine={fine}
                  referenceTime={renderTime}
                  canManage={canManage}
                  canPay={Boolean(canPay && selectedCompanyId)}
                  selected={selectedIds.includes(fine.id)}
                  onToggle={() => toggleFine(fine.id)}
                  onPay={() => setPaymentFine(fine)}
                  onCopy={() => void copyDecree(fine)}
                  copyFeedback={copyFeedback?.id === fine.id ? copyFeedback.text : undefined}
                />
              ),
            )}
          </section>
        </>
      )}
      {activeFine
        ? createPortal(
            <Modal
              open
              title={activeFine.kind === 'TOLL' ? 'Платная дорога' : `Штраф № ${activeFine.decreeNumber || '—'}`}
              onOpenChange={(open) => {
                if (!open) setActiveFine(null);
              }}
              className="max-h-[calc(100dvh-2rem)] !max-w-4xl overflow-y-auto"
              backdropClassName="!z-[120]"
              footer={
                <Button variant="outline" onClick={() => setActiveFine(null)}>
                  Закрыть
                </Button>
              }
            >
              <FineDetailModalContent
                fine={activeFine}
                referenceTime={renderTime}
                canPay={Boolean(canPay && selectedCompanyId)}
                onPay={() => {
                  setPaymentFine(activeFine);
                  setActiveFine(null);
                }}
              />
            </Modal>,
            document.body,
          )
        : null}
      {paymentFine && selectedCompanyId && canPay
        ? createPortal(
            <Modal
              open
              title="Оплатить штраф"
              onOpenChange={(open) => {
                if (!open) setPaymentFine(null);
              }}
              className="max-h-[90dvh] !max-w-xl overflow-y-auto"
              backdropClassName="!z-[120]"
              footer={
                <Button variant="outline" onClick={() => setPaymentFine(null)}>
                  Закрыть
                </Button>
              }
            >
              <FinePaymentPanel
                key={paymentFine.id}
                companyId={selectedCompanyId}
                selectedFines={[paymentFine]}
              />
            </Modal>,
            document.body,
          )
        : null}
      {pagination ? (
        <nav
          aria-label="Страницы штрафов"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Показано {fines.length} из {pagination.total}
            </p>
            <form action="/fines" method="get">
              {Object.entries(filters).map(([key, value]) =>
                value && key !== 'pageSize' ? (
                  <input key={key} type="hidden" name={key} value={value} />
                ) : null,
              )}
              <label className="flex items-center gap-2 text-sm font-semibold">
                <span className="text-[var(--color-text-secondary)]">Показывать</span>
                <select
                  name="pageSize"
                  defaultValue={String(pagination.pageSize)}
                  onChange={(event) => event.currentTarget.form?.requestSubmit()}
                  className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
                >
                  <option value="50">50 на странице</option>
                  <option value="100">100 на странице</option>
                  <option value="150">150 на странице</option>
                </select>
              </label>
            </form>
          </div>
          <div className="flex gap-2">
            {pagination.page > 1 ? (
              <Link
                href={filterUrl(filters, pagination.page - 1)}
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border px-4 font-semibold"
              >
                <FiChevronLeft aria-hidden="true" /> Назад
              </Link>
            ) : null}
            {pagination.page < pagination.totalPages ? (
              <Link
                href={filterUrl(filters, pagination.page + 1)}
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border px-4 font-semibold"
              >
                Вперёд <FiChevronRight aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
