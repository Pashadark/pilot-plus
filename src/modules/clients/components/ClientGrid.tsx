import type { ClientCardDto } from '../types';
import type { ClientRatingSummary } from '@/modules/client-rating/types';
import { EmptyState } from '@/shared/ui';

import { ClientCard } from './ClientCard';

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
    <section
      aria-label="Список клиентов"
      className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
    >
      {clients.map((client) => (
        <ClientCard key={client.id} client={client} rating={ratings[client.id]} />
      ))}
    </section>
  );
}
