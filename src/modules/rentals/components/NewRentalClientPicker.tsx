import Link from 'next/link';
import { FiArrowRight, FiPlus, FiSearch, FiUser } from 'react-icons/fi';

import { Badge, EmptyState, PageHeader } from '@/shared/ui';

type RentalClientOption = {
  id: string;
  fullName: string;
  phone: string | null;
  status: string;
};

const statusLabel: Record<string, string> = {
  ACTIVE: 'Активен',
  ARCHIVED: 'В архиве',
  DRAFT: 'Черновик',
  NEW: 'Новый',
  REGULAR: 'Постоянный',
  VERIFIED: 'Проверен',
  VERIFYING: 'На проверке',
  BLOCKED: 'Заблокирован',
};

export function NewRentalClientPicker({
  clients,
  query,
}: {
  clients: readonly RentalClientOption[];
  query: string;
}) {
  return (
    <main className="grid gap-5 p-4 sm:p-6">
      <PageHeader
        eyebrow="Новый договор"
        title="Выберите клиента"
        description="Сначала выберите существующего клиента. После этого откроются автомобиль, сроки и условия аренды."
        actions={
          <Link
            href="/clients?form=new"
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white"
          >
            <FiPlus aria-hidden />
            Создать нового клиента
          </Link>
        }
      />

      <form className="flex max-w-2xl gap-2 rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] border px-3">
          <FiSearch aria-hidden className="shrink-0 text-[var(--color-text-secondary)]" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Фамилия, имя или телефон"
            aria-label="Поиск клиента"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <button className="min-h-11 rounded-[var(--radius-md)] border px-4 font-semibold">
          Найти
        </button>
      </form>

      {clients.length ? (
        <section
          aria-label="Клиенты для новой аренды"
          className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3"
        >
          {clients.map((client) => (
            <article
              key={client.id}
              className="grid gap-4 rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <FiUser aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-bold">{client.fullName}</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {client.phone ?? 'Нет телефона'}
                  </p>
                </div>
                <Badge tone={client.status === 'BLOCKED' ? 'danger' : 'success'}>
                  {statusLabel[client.status] ?? client.status}
                </Badge>
              </div>
              <Link
                href={`/clients/${client.id}/rentals/new`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white"
              >
                Выбрать и продолжить
                <FiArrowRight aria-hidden />
              </Link>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          title="Клиенты не найдены"
          description="Измените поиск или создайте нового клиента, чтобы оформить аренду."
        />
      )}
    </main>
  );
}
