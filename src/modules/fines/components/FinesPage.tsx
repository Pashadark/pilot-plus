import Link from 'next/link';

import { Badge, Card, CardContent, PageHeader, StatCard } from '@/shared/ui';
import { syncFinesAction } from '../server/sync-action';

interface FineItem {
  id: string;
  decreeNumber: string;
  offenseAt: string;
  currentAmountMinor: string;
  originalAmountMinor: string;
  status: 'NEW' | 'UNPAID' | 'PAID' | 'CANCELLED' | 'OVERDUE';
  description: string | null;
  address: string | null;
  vehicleLabel: string;
  clientLabel: string | null;
  photoAvailable: boolean;
}

interface FinesPageProps {
  summary: {
    newCount: number;
    unpaidCount: number;
    unpaidAmountMinor: string;
    unassignedCount: number;
  };
  fines: readonly FineItem[];
  companies: readonly { id: string; name: string }[];
  selectedCompanyId?: string;
  canSync: boolean;
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

export function FinesPage({
  summary,
  fines,
  companies,
  selectedCompanyId,
  canSync,
}: FinesPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Контроль автопарка"
        title="Штрафы"
        description="Штрафы Driver Helper, связанные с автомобилями, арендами и клиентами."
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <form
            action="/fines"
            method="get"
            className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md"
          >
            <label htmlFor="fine-company" className="text-sm font-medium">
              Фирма
            </label>
            <select
              id="fine-company"
              name="companyId"
              defaultValue={selectedCompanyId ?? ''}
              className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
              onChange={undefined}
            >
              {companies.length > 1 && <option value="">Все доступные фирмы</option>}
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <button className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 font-semibold">
              Показать
            </button>
          </form>
          {canSync && selectedCompanyId && (
            <form action={syncFinesAction}>
              <input type="hidden" name="companyId" value={selectedCompanyId} />
              <button className="min-h-11 w-full rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 font-semibold text-white sm:w-auto">
                Обновить штрафы
              </button>
            </form>
          )}
        </CardContent>
      </Card>

      <section aria-label="Сводка по штрафам" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Новые" value={String(summary.newCount)} />
        <StatCard label="Неоплаченные" value={String(summary.unpaidCount)} />
        <StatCard label="Сумма" value={money(summary.unpaidAmountMinor)} />
        <StatCard label="Требуют привязки" value={String(summary.unassignedCount)} />
      </section>

      {fines.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-[var(--color-text-secondary)]">
            Штрафов пока нет. Выполните синхронизацию Driver Helper.
          </CardContent>
        </Card>
      ) : (
        <section aria-label="Список штрафов" className="grid gap-4 xl:grid-cols-2">
          {fines.map((fine) => {
            const status = statusPresentation[fine.status];
            return (
              <Card key={fine.id} className="min-w-0">
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--color-text-secondary)]">Постановление</p>
                      <p className="font-semibold break-all">{fine.decreeNumber}</p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-[var(--color-text-secondary)]">Автомобиль</p>
                      <p className="font-medium">{fine.vehicleLabel || 'Не привязан'}</p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-secondary)]">Клиент</p>
                      <p className="font-medium">{fine.clientLabel || 'Не определён'}</p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-secondary)]">Нарушение</p>
                      <p>
                        {new Intl.DateTimeFormat('ru-RU', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: 'Europe/Moscow',
                        }).format(new Date(fine.offenseAt))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-secondary)]">К оплате</p>
                      <p className="text-lg font-bold">{money(fine.currentAmountMinor)}</p>
                    </div>
                  </div>
                  {(fine.description || fine.address) && (
                    <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                      {[fine.description, fine.address].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {fine.photoAvailable && (
                    <Link
                      href={`/fines/${fine.id}/photo`}
                      className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                    >
                      Посмотреть фото
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
