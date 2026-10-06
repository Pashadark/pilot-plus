'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/shared/ui/Overlays';
import { FiChevronDown, FiChevronLeft, FiChevronRight, FiRefreshCw } from 'react-icons/fi';

import { syncFinesAction } from '../server/sync-action';
import { Badge, Button, Card, CardContent, PageHeader, StatCard } from '@/shared/ui';

import { type FineAssignmentCandidate } from './FineAssignmentReview';
import { FinePaymentPanel } from './FinePaymentPanel';
import { discountBadge } from './fine-card-presentation';
import { FineCard } from './FineCard';

export interface FineItem {
  kind?: 'TOLL';
  roadLabel?: string;
  rentalId?: string | null;
  checkedAt?: string | null;
  id: string;
  companyId?: string;
  decreeNumber: string;
  decreeAt?: string | null;
  assignmentConfirmedAt?: string | null;
  offenseAt: string;
  currentAmountMinor: string;
  originalAmountMinor: string;
  status: 'NEW' | 'UNPAID' | 'PAID' | 'CANCELLED' | 'OVERDUE';
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
}

interface FinesPageProps {
  referenceTime?: string;
  summary: {
    newCount: number;
    unpaidCount: number;
    unpaidAmountMinor: string;
    unassignedCount: number;
    discountEndingSoonCount?: number;
    bailiffRiskCount?: number;
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
  return fine.kind !== 'TOLL' && fine.status !== 'PAID' && fine.status !== 'CANCELLED';
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

export function FinesPage({
  referenceTime,
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

  return (
    <div className="flex flex-col gap-5">
      <div className="order-[-2]">
        <PageHeader
          eyebrow="Контроль автопарка"
          title="Штрафы"
          description="Штрафы и платные дороги, связанные с автомобилями, арендами и клиентами."
        />
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
      <Card>
        <CardContent>
          <form action="/fines" method="get" className="grid min-w-0 gap-3">
            <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(12rem,0.7fr)_minmax(10rem,0.45fr)_minmax(16rem,1fr)_auto] lg:items-end">
              <label className="grid min-w-0 gap-1.5" htmlFor="fine-company">
                <span className="text-sm font-medium">Фирма</span>
                <select
                  id="fine-company"
                  name="companyId"
                  defaultValue={selectedCompanyId ?? ''}
                  className="min-h-11 min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
                >
                  {companies.length > 1 ? <option value="">Все доступные фирмы</option> : null}
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-0 gap-1.5">
                <span className="text-sm font-medium">Статус</span>
                <select
                  name="status"
                  defaultValue={filters.status ?? ''}
                  className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
                >
                  <option value="">Все статусы</option>
                  {Object.entries(statusPresentation).map(([value, presentation]) => (
                    <option key={value} value={value}>
                      {presentation.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-0 gap-1.5">
                <span className="text-sm font-medium">Поиск</span>
                <input
                  name="query"
                  defaultValue={filters.query ?? ''}
                  placeholder="Номер, клиент, постановление или договор"
                  className="min-h-11 min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
                />
              </label>
              <Button type="submit">Показать</Button>
            </div>
            <details
              data-testid="fine-advanced-filters"
              open={advancedFilterCount > 0 || undefined}
              className="group border-t border-[var(--color-border)] pt-3"
            >
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
                <span>Все фильтры{advancedFilterCount ? ` · ${advancedFilterCount}` : ''}</span>
                <FiChevronDown aria-hidden className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
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
              <Button type="submit" leadingIcon={<FiRefreshCw aria-hidden="true" />}>
                Обновить штрафы
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
      <section
        aria-label="Сводка по штрафам"
        className="order-[-1] grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        <StatCard label="Новые" value={String(summary.newCount)} />
        <StatCard label="Неоплаченные" value={String(summary.unpaidCount)} />
        <StatCard label="Сумма" value={money(summary.unpaidAmountMinor)} />
        <StatCard label="Требуют привязки" value={String(summary.unassignedCount)} />
        <StatCard
          label="Скидка заканчивается"
          value={String(summary.discountEndingSoonCount ?? 0)}
        />
        <StatCard label="Риск передачи приставам" value={String(summary.bailiffRiskCount ?? 0)} />
      </section>
      {canPay && selectedCompanyId && selectedFines.length ? (
        <FinePaymentPanel companyId={selectedCompanyId} selectedFines={selectedFines} />
      ) : null}
      {fines.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-[var(--color-text-secondary)]">
            Штрафы по этим фильтрам не найдены.
          </CardContent>
        </Card>
      ) : (
        <section
          aria-label="Список штрафов"
          className="grid min-w-0 items-start gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {orderedFines.map((fine) => {
            if (fine.kind === 'TOLL')
              return (
                <Card key={fine.id} className="min-w-0" data-testid="toll-debt-card">
                  <CardContent className="space-y-4 !p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="primary">{fine.roadLabel}</Badge>
                      <Badge tone="neutral">Платная дорога</Badge>
                      <Badge tone="warning">Не оплачен</Badge>
                    </div>
                    <div>
                      <h2 className="text-base leading-6 font-semibold">{fine.vehicleLabel}</h2>
                      <p className="mt-1 line-clamp-2 min-h-10 text-sm text-[var(--color-text-secondary)]">
                        {fine.description}
                      </p>
                    </div>
                    <strong className="block text-2xl font-semibold tabular-nums">
                      {money(fine.currentAmountMinor)}
                    </strong>
                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 border-t pt-3 text-xs">
                      <dt className="text-[var(--color-text-secondary)]">Арендатор</dt>
                      <dd className="break-words">{fine.clientLabel ?? 'Не определён'}</dd>
                      <dt className="text-[var(--color-text-secondary)]">Проезд</dt>
                      <dd>{formatDate(fine.offenseAt)}</dd>
                      <dt className="text-[var(--color-text-secondary)]">Договор</dt>
                      <dd>
                        {fine.rentalId ? (
                          <Link
                            className="text-[var(--color-primary)] hover:underline"
                            href={`/rentals/${fine.rentalId}`}
                          >
                            {fine.rentalLabel}
                          </Link>
                        ) : (
                          'Не найден однозначно'
                        )}
                      </dd>
                    </dl>
                    {fine.checkedAt ? (
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        Проверено {formatDate(fine.checkedAt)}
                      </p>
                    ) : null}
                    {fine.rentalId ? (
                      <Link
                        className="flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border px-3 text-sm font-medium text-[var(--color-primary)]"
                        href={`/rentals/${fine.rentalId}`}
                      >
                        Открыть аренду
                      </Link>
                    ) : null}
                  </CardContent>
                </Card>
              );
            return (
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
            );
          })}
        </section>
      )}
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
      {pagination && pagination.totalPages > 1 ? (
        <nav
          aria-label="Страницы штрафов"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-[var(--color-text-secondary)]">
            Показано {fines.length} из {pagination.total}
          </p>
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
