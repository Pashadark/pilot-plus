'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  FiAlertTriangle,
  FiCamera,
  FiChevronLeft,
  FiChevronRight,
  FiRefreshCw,
} from 'react-icons/fi';

import { syncFinesAction } from '../server/sync-action';
import { Badge, Button, Card, CardContent, PageHeader, StatCard } from '@/shared/ui';

import { FineAssignmentReview, type FineAssignmentCandidate } from './FineAssignmentReview';
import { FinePaymentPanel } from './FinePaymentPanel';

export interface FineItem {
  id: string;
  companyId?: string;
  decreeNumber: string;
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
}

const statusPresentation = {
  NEW: { label: 'Новый', tone: 'primary' },
  UNPAID: { label: 'Не оплачен', tone: 'warning' },
  PAID: { label: 'Оплачен', tone: 'success' },
  CANCELLED: { label: 'Отменён', tone: 'neutral' },
  OVERDUE: { label: 'Просрочен', tone: 'danger' },
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
  return fine.status !== 'PAID' && fine.status !== 'CANCELLED';
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
}: FinesPageProps) {
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const selectedFines = useMemo(
    () => fines.filter((fine) => selectedIds.includes(fine.id) && payable(fine)),
    [fines, selectedIds],
  );
  const toggleFine = (fineId: string) =>
    setSelectedIds((ids) =>
      ids.includes(fineId) ? ids.filter((id) => id !== fineId) : [...ids, fineId],
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Контроль автопарка"
        title="Штрафы"
        description="Штрафы Driver Helper, связанные с автомобилями, арендами и клиентами."
      />
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
          <form
            action="/fines"
            method="get"
            className="grid min-w-0 gap-3 lg:grid-cols-4 lg:items-end"
          >
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
            <Button type="submit" variant="secondary">
              Показать
            </Button>
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
      <section aria-label="Сводка по штрафам" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
        <section aria-label="Список штрафов" className="grid min-w-0 gap-4 xl:grid-cols-2">
          {fines.map((fine) => {
            const status = statusPresentation[fine.status];
            const hasDiscount = fine.currentAmountMinor !== fine.originalAmountMinor;
            return (
              <Card key={fine.id} className="min-w-0">
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {canPay && selectedCompanyId && payable(fine) ? (
                        <label className="flex min-h-11 shrink-0 items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(fine.id)}
                            onChange={() => toggleFine(fine.id)}
                            aria-label={`Выбрать для оплаты постановление ${fine.decreeNumber}`}
                            className="size-5 accent-[var(--color-primary)]"
                          />
                          <span className="sr-only">Выбрать для оплаты</span>
                        </label>
                      ) : null}
                      <div className="min-w-0">
                        <p className="text-xs text-[var(--color-text-secondary)]">Постановление</p>
                        <p className="font-semibold break-all">{fine.decreeNumber}</p>
                      </div>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-[var(--color-text-secondary)]">Автомобиль</p>
                      <p className="font-medium break-words">
                        {fine.vehicleLabel || 'Не привязан'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-secondary)]">Нарушение</p>
                      <p>{formatDate(fine.offenseAt)}</p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-secondary)]">К оплате</p>
                      <p className="text-lg font-bold tabular-nums">
                        {money(fine.currentAmountMinor)}
                      </p>
                      {hasDiscount ? (
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          Вместо {money(fine.originalAmountMinor)}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-[var(--color-text-secondary)]">Скидка</p>
                      <p>
                        {fine.discountExpiresAt
                          ? `До ${formatDate(fine.discountExpiresAt)}`
                          : 'Не предусмотрена'}
                      </p>
                    </div>
                  </div>
                  {fine.toBailiff ? (
                    <p className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-danger-soft)] p-3 text-sm font-semibold text-[var(--color-danger)]">
                      <FiAlertTriangle aria-hidden="true" /> Передача приставам: требуется
                      приоритетная проверка.
                    </p>
                  ) : null}
                  {fine.description || fine.address || fine.comment ? (
                    <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                      {[fine.description, fine.address, fine.comment].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                  {fine.companyId ? (
                    <FineAssignmentReview
                      companyId={fine.companyId}
                      fineId={fine.id}
                      canManage={canManage}
                      confirmedClientLabel={fine.clientLabel}
                      confirmedContractLabel={fine.rentalLabel}
                      candidates={fine.assignmentCandidates ?? []}
                    />
                  ) : (
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Клиент: {fine.clientLabel ?? 'Не определён'}
                    </p>
                  )}
                  {fine.photoAvailable ? (
                    <Link
                      href={`/fines/${fine.id}/photo`}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                    >
                      <FiCamera aria-hidden="true" /> Посмотреть фото
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
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
