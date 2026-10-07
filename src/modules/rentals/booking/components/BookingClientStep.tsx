'use client';

import { useMemo, useState, useTransition } from 'react';
import { FiCheck, FiPlus, FiSearch, FiUser } from 'react-icons/fi';

import { createClientAction } from '@/modules/clients/actions';
import { Button } from '@/shared/ui';

import type { BookingClientOption } from '../types';

export function BookingClientStep({
  companyId,
  clients,
  selectedId,
  onSelect,
}: {
  companyId: string;
  clients: BookingClientOption[];
  selectedId: string;
  onSelect(client: BookingClientOption): void;
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState(clients);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru-RU');
    if (!normalized) return items.slice(0, 12);
    return items
      .filter((client) =>
        `${client.fullName} ${client.phone ?? ''}`.toLocaleLowerCase('ru-RU').includes(normalized),
      )
      .slice(0, 12);
  }, [items, query]);

  function createClient(formData: FormData) {
    setError('');
    startTransition(async () => {
      const result = await createClientAction({ status: 'idle' }, formData);
      if (result.status !== 'success' || !result.client) {
        setError(result.status === 'error' ? result.message : 'Не удалось создать клиента.');
        return;
      }
      const client: BookingClientOption = {
        ...result.client,
        companyId,
        documentsReady: false,
      };
      setItems((current) => [client, ...current]);
      onSelect(client);
      setCreating(false);
    });
  }

  if (creating) {
    return (
      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Новый клиент</h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              После сохранения клиент выберется автоматически.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="min-h-11 rounded-[var(--radius-sm)] px-3 text-sm font-semibold text-[var(--color-primary)]"
          >
            К поиску
          </button>
        </div>
        <form action={createClient} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="status" value="DRAFT" />
          {[
            'additionalPhone',
            'email',
            'passport',
            'passportSeries',
            'passportNumber',
            'passportIssuedBy',
            'passportIssuedAt',
            'passportDivisionCode',
            'registrationAddress',
            'actualAddress',
            'driverLicense',
            'driverLicenseIssuedAt',
            'driverLicenseExpiresAt',
          ].map((name) => (
            <input key={name} type="hidden" name={name} value="" />
          ))}
          <label className="grid gap-1 text-sm font-semibold">
            Фамилия
            <input
              name="lastName"
              required
              className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Имя
            <input
              name="firstName"
              required
              className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Отчество
            <input
              name="middleName"
              className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Телефон
            <input
              name="phone"
              type="tel"
              placeholder="+7 999 000-00-00"
              className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
            Дата рождения
            <input
              name="birthDate"
              type="date"
              className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-[var(--color-danger)] sm:col-span-2">
              {error}
            </p>
          ) : null}
          <button
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            <FiPlus aria-hidden /> {pending ? 'Сохраняем…' : 'Создать и выбрать'}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <div>
        <h3 className="text-lg font-bold">Клиент</h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Найдите клиента по имени или телефону
        </p>
      </div>
      <div
        role="group"
        aria-label="Поиск и создание клиента"
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
      >
        <label className="relative min-w-0">
          <FiSearch
            aria-hidden
            className="absolute top-3.5 left-3 text-[var(--color-text-tertiary)]"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Поиск клиента"
            placeholder="Имя или телефон"
            className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] pr-3 pl-10 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          />
        </label>
        <Button
          variant="soft"
          size="sm"
          onClick={() => setCreating(true)}
          leadingIcon={<FiPlus aria-hidden />}
          className="whitespace-nowrap"
        >
          Новый клиент
        </Button>
      </div>
      <div className="grid max-h-[42dvh] gap-2 overflow-y-auto pr-1">
        {filtered.map((client) => (
          <button
            key={client.id}
            type="button"
            onClick={() => onSelect(client)}
            aria-pressed={selectedId === client.id}
            className="flex min-h-[72px] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-left transition-[border-color,background-color,box-shadow] duration-[var(--motion-fast)] hover:border-[var(--color-border-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] aria-pressed:border-[var(--color-primary)] aria-pressed:bg-[var(--color-primary-soft)] aria-pressed:shadow-[var(--shadow-card)]"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-elevated)] text-[var(--color-primary)]">
              <FiUser aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm">{client.fullName}</b>
              <span className="block text-xs text-[var(--color-text-secondary)]">
                {client.phone ?? 'Телефон не указан'}
              </span>
              {client.documentsReady ? (
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-success)]">
                  <span className="size-1.5 rounded-full bg-[var(--color-success)]" /> Документы проверены
                </span>
              ) : null}
            </span>
            {selectedId === client.id ? (
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-primary)] text-[var(--color-text-inverse)]">
                <FiCheck aria-hidden />
              </span>
            ) : null}
          </button>
        ))}
        {!filtered.length ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-4 text-sm text-[var(--color-text-secondary)]">
            Клиенты не найдены.
          </p>
        ) : null}
      </div>
    </section>
  );
}
