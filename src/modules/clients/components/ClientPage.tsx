'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { FiPlus } from 'react-icons/fi';

import type { ClientListResult, ClientQueryFilters } from '../types';
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
}: {
  result: ClientListResult;
  filters: ClientQueryFilters;
  canManage: boolean;
  companies: readonly { id: string; name: string }[];
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
        eyebrow="Клиенты"
        title="Клиенты"
        description="Контакты и документы клиентов в доступных компаниях."
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
      <ClientFilters filters={filters} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone="primary" size="lg">
          Страница {result.page}
        </Badge>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Показано {result.items.length} клиентов
        </p>
      </div>
      <ClientGrid clients={result.items} />
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
