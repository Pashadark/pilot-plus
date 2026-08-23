'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { FiPlus } from 'react-icons/fi';

import type { ClientListResult, ClientQueryFilters } from '../types';
import type { ClientRatingSummary } from '@/modules/client-rating/types';
import { Badge, Button, PageHeader } from '@/shared/ui';

import { clientQueryHref } from './client-query';
import { ClientFilters } from './ClientFilters';
import { ClientForm } from './ClientForm';
import { ClientGrid } from './ClientGrid';

export function ClientPage({
  result,
  filters,
  canManage,
  companies,
  ratings = {},
}: {
  result: ClientListResult;
  filters: ClientQueryFilters;
  canManage: boolean;
  companies: readonly { id: string; name: string }[];
  ratings?: Readonly<Record<string, ClientRatingSummary>>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextHref = clientQueryHref(searchParams, { page: String(result.page + 1) });
  const previousHref = clientQueryHref(searchParams, {
    page: result.page > 1 ? String(result.page - 1) : undefined,
  });

  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="client-page">
      <PageHeader
        eyebrow="Клиентская база"
        title="Клиенты"
        description="Контакты, надёжность, история аренд и текущие автомобили клиентов."
        actions={
          canManage ? (
            <Button
              onClick={() => router.push('/clients?form=new')}
              leadingIcon={<FiPlus aria-hidden="true" />}
            >
              Добавить клиента
            </Button>
          ) : null
        }
      />
      {canManage && searchParams.get('form') === 'new' ? (
        <ClientForm companies={companies} />
      ) : null}
      <nav aria-label="Быстрые фильтры клиентов" className="flex flex-wrap gap-2">
        {[
          { label: 'Все', href: '/clients' },
          { label: 'Сейчас арендуют', href: '/clients?renting=active' },
          { label: 'Постоянные', href: '/clients?status=REGULAR' },
          { label: 'На проверке', href: '/clients?status=VERIFYING' },
          { label: 'Заблокированные', href: '/clients?status=BLOCKED' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex min-h-10 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <ClientFilters filters={filters} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone="primary" size="lg">
          Страница {result.page}
        </Badge>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Показано {result.items.length} клиентов
        </p>
      </div>
      <ClientGrid clients={result.items} ratings={ratings} />
      <nav aria-label="Пагинация клиентов" className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={result.page === 1}
          onClick={() => router.push(previousHref)}
        >
          Назад
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={result.items.length < result.pageSize}
          onClick={() => router.push(nextHref)}
        >
          Далее
        </Button>
      </nav>
    </main>
  );
}
