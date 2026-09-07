import Link from 'next/link';
import { FiEye } from 'react-icons/fi';

import type { ClientCardDto } from '../types';
import type { ClientRatingSummary } from '@/modules/client-rating/types';
import { Badge, EmptyState } from '@/shared/ui';
import { ClientRatingStars } from '@/modules/client-rating/components/ClientRatingStars';

import { ClientCard, clientStatusView } from './ClientCard';
import { ClientPhoto } from './ClientPhoto';
import { clientRentalColor, formatMinorMoney, presentClientDeposit } from './client-deposit';

const rentalRowClasses = {
  neutral: 'hover:bg-[var(--color-elevated)]',
  success: 'bg-[var(--color-success-soft)] hover:brightness-[0.98]',
  primary: 'bg-[var(--color-primary-soft)] hover:brightness-[0.98]',
  warning: 'bg-[var(--color-warning-soft)] hover:brightness-[0.98]',
} as const;

function formatRentalDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(value));
}

export function ClientGrid({
  clients,
  ratings = {},
}: {
  clients: readonly ClientCardDto[];
  ratings?: Readonly<Record<string, ClientRatingSummary>>;
}) {
  if (!clients.length) {
    return (
      <EmptyState
        title="Клиенты не найдены"
        description="Измените условия поиска или сбросьте фильтры, чтобы увидеть доступные карточки."
      />
    );
  }

  return (
    <section aria-label="Список клиентов" className="min-w-0">
      <div className="grid gap-3 md:hidden">
        {clients.map((client) => (
          <ClientCard key={client.id} client={client} rating={ratings[client.id]} />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] md:block">
        <table className="w-full min-w-[1420px] border-collapse text-left text-sm font-normal">
          <thead className="bg-[var(--color-elevated)] text-xs font-medium tracking-wide text-[var(--color-text-secondary)] uppercase">
            <tr>
              <th className="px-3 py-2.5">Клиент</th>
              <th className="px-3 py-2.5">Телефон</th>
              <th className="px-3 py-2.5">Рейтинг</th>
              <th className="px-3 py-2.5">Аренды</th>
              <th className="px-3 py-2.5 text-right">Штрафы</th>
              <th className="px-3 py-2.5">Машина</th>
              <th className="px-3 py-2.5 text-right">Стоимость аренды</th>
              <th className="px-3 py-2.5 text-right">Депозит</th>
              <th className="px-3 py-2.5">Статус депозита</th>
              <th className="px-3 py-2.5">Дата возврата</th>
              <th className="px-3 py-2.5">Статус</th>
              <th className="px-3 py-2.5 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {clients.map((client) => {
              const status = clientStatusView[client.status];
              const current = client.rentalSummary.current;
              const last = client.rentalSummary.last;
              const depositRental = current ?? last;
              const deposit = presentClientDeposit(depositRental, Boolean(current));
              const rentalColor = clientRentalColor(depositRental, Boolean(current));
              return (
                <tr
                  key={client.id}
                  className={`h-[72px] transition-[filter] ${rentalRowClasses[rentalColor]}`}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex min-w-[220px] items-center gap-2.5">
                      <ClientPhoto
                        name={client.fullName}
                        localPhotoUrl={client.localPhotoUrl}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-medium hover:text-[var(--color-primary)]"
                        >
                          {client.fullName}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{client.phone}</td>
                  <td className="px-3 py-2.5">
                    {ratings[client.id] ? (
                      <ClientRatingStars rating={ratings[client.id]} compact />
                    ) : (
                      <span className="text-sm text-[var(--color-text-secondary)]">Нет оценки</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="tabular-nums">{client.rentalSummary.total}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {last ? `Последняя: ${formatRentalDate(last.endsAt)}` : 'Нет аренд'}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <p>{client.fineSummary.total}</p>
                    <p className="mt-1 text-xs whitespace-nowrap text-[var(--color-text-secondary)]">
                      Оплачено: {formatMinorMoney(client.fineSummary.paidAmountMinor)}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    {depositRental ? (
                      <div className="min-w-[190px]">
                        <p>{depositRental.vehicle.label}</p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {depositRental.vehicle.registrationNumber ?? 'Без номера'}
                          {depositRental.contractNumber ? ` · ${depositRental.contractNumber}` : ''}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--color-text-secondary)]">Нет аренды</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <p className="whitespace-nowrap">
                      {depositRental ? formatMinorMoney(depositRental.totalPriceMinor) : '—'}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <p className="whitespace-nowrap">{deposit.amount}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    {deposit.label ? <Badge tone={deposit.tone}>{deposit.label}</Badge> : '—'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                    {deposit.returnedAtLabel}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`/clients/${client.id}`}
                      aria-label="Открыть карточку клиента"
                      title="Открыть карточку клиента"
                      className="inline-flex size-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                    >
                      <FiEye aria-hidden="true" className="size-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
