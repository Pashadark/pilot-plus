import Link from 'next/link';

import type { ClientCardDto } from '../types';
import type { ClientRatingSummary } from '@/modules/client-rating/types';
import { Badge, EmptyState } from '@/shared/ui';
import { ClientRatingStars } from '@/modules/client-rating/components/ClientRatingStars';

import { ClientCard, clientStatusView } from './ClientCard';
import { ClientPhoto } from './ClientPhoto';

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
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead className="bg-[var(--color-elevated)] text-xs font-semibold tracking-wide text-[var(--color-text-secondary)] uppercase">
            <tr>
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Рейтинг</th>
              <th className="px-4 py-3">Аренды</th>
              <th className="px-4 py-3">Текущая машина</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {clients.map((client) => {
              const status = clientStatusView[client.status];
              const current = client.rentalSummary.current;
              const last = client.rentalSummary.last;
              return (
                <tr key={client.id} className="transition-colors hover:bg-[var(--color-elevated)]">
                  <td className="px-4 py-3">
                    <div className="flex min-w-[250px] items-center gap-3">
                      <ClientPhoto
                        name={client.fullName}
                        localPhotoUrl={client.localPhotoUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-bold hover:text-[var(--color-primary)]"
                        >
                          {client.fullName}
                        </Link>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          {client.phoneMasked}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {ratings[client.id] ? (
                      <ClientRatingStars rating={ratings[client.id]} compact />
                    ) : (
                      <span className="text-sm text-[var(--color-text-secondary)]">Нет оценки</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold tabular-nums">{client.rentalSummary.total}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {last ? `Последняя: ${formatRentalDate(last.endsAt)}` : 'Нет аренд'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {current ? (
                      <div className="min-w-[190px]">
                        <p className="font-semibold">{current.vehicle.label}</p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {current.vehicle.registrationNumber ?? 'Без номера'}
                          {current.contractNumber ? ` · ${current.contractNumber}` : ''}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        Сейчас не арендует
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/clients/${client.id}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm font-semibold hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                    >
                      Открыть
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
