'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, type FormEvent } from 'react';

import type { ClientQueryFilters, ClientStatus } from '../types';
import { Button, Card, SearchInput, Select } from '@/shared/ui';

import { clientQueryHref } from './client-query';

const statuses: readonly { value: ClientStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Черновик' },
  { value: 'NEW', label: 'Новый' },
  { value: 'VERIFYING', label: 'На проверке' },
  { value: 'VERIFIED', label: 'Проверен' },
  { value: 'REGULAR', label: 'Постоянный' },
  { value: 'BLOCKED', label: 'Заблокирован' },
];

export function ClientFilters({ filters }: { filters: ClientQueryFilters }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const update = (updates: Record<string, string | undefined>) => {
    startTransition(() =>
      router.push(clientQueryHref(searchParams, { ...updates, page: undefined })),
    );
  };
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('q');
    update({ q: typeof value === 'string' ? value.trim() : undefined });
  };
  const reset = () => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      ['q', 'status', 'documents', 'license', 'page'].forEach((key) => params.delete(key));
      router.push(params.size ? `/clients?${params}` : '/clients');
    });
  };

  return (
    <Card className="p-4">
      <form
        onSubmit={search}
        className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_12rem_12rem_12rem_auto] xl:items-end"
      >
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Поиск</span>
          <SearchInput
            name="q"
            defaultValue={filters.q}
            placeholder="Имя или email"
            aria-label="Поиск клиентов"
          />
        </label>
        <Select
          label="Статус"
          value={filters.status ?? ''}
          onChange={(event) => update({ status: event.target.value || undefined })}
        >
          <option value="">Все статусы</option>
          {statuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </Select>
        <Select
          label="Паспорт"
          value={filters.documents ?? ''}
          onChange={(event) => update({ documents: event.target.value || undefined })}
        >
          <option value="">Все</option>
          <option value="present">Есть данные</option>
          <option value="missing">Нет данных</option>
        </Select>
        <Select
          label="Водительское удостоверение"
          value={filters.license ?? ''}
          onChange={(event) => update({ license: event.target.value || undefined })}
        >
          <option value="">Все</option>
          <option value="present">Есть данные</option>
          <option value="missing">Нет данных</option>
        </Select>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" disabled={pending}>
            Найти
          </Button>
          <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
            Сбросить
          </Button>
        </div>
      </form>
    </Card>
  );
}
