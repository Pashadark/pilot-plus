'use client';

import { useMemo, useState, useTransition } from 'react';
import { FiArrowLeft, FiCheck, FiPlus, FiSearch, FiUser } from 'react-icons/fi';

import { Button } from '@/shared/ui';

import type { RentalConstructorClientOption } from '../server/bootstrap';
import { createConstructorClientAction } from '../server/actions';

function phoneKey(value: string | null | undefined) {
  const digits = value?.replace(/\D/gu, '') ?? '';
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

const emptyClientFields = [
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
] as const;

export function ClientSection({
  companyId,
  clients,
  selectedId,
  onSelected,
}: {
  companyId: string;
  clients: readonly RentalConstructorClientOption[];
  selectedId?: string;
  onSelected(client: RentalConstructorClientOption): void;
}) {
  const [items, setItems] = useState([...clients]);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const duplicate = useMemo(() => {
    const key = phoneKey(phone);
    return key.length === 10 ? items.find((client) => phoneKey(client.phone) === key) : undefined;
  }, [items, phone]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru-RU');
    if (!normalized) return items.slice(0, 30);
    return items
      .filter((client) =>
        `${client.fullName} ${client.phone ?? ''}`.toLocaleLowerCase('ru-RU').includes(normalized),
      )
      .slice(0, 30);
  }, [items, query]);

  function submit(formData: FormData) {
    setError('');
    setFieldErrors({});
    startTransition(async () => {
      const result = await createConstructorClientAction(null, formData);
      if (!result.ok) {
        setError(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      const next: RentalConstructorClientOption = { ...result.client, companyId };
      setItems((current) => [next, ...current]);
      onSelected(next);
      setCreating(false);
    });
  }

  if (creating) {
    return (
      <section className="grid gap-4" aria-labelledby="constructor-new-client-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="constructor-new-client-title" className="text-lg font-bold">
              Новый клиент
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Сохраним черновик клиента и продолжим оформление без перехода на другую страницу.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={<FiArrowLeft aria-hidden />}
            onClick={() => setCreating(false)}
          >
            К списку
          </Button>
        </div>

        <form action={submit} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="companyId" value={companyId} />
          {emptyClientFields.map((name) => (
            <input key={name} type="hidden" name={name} value="" />
          ))}
          <label className="grid gap-1 text-sm font-semibold">
            Фамилия
            <input
              name="lastName"
              required
              aria-invalid={Boolean(fieldErrors.lastName)}
              className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Имя
            <input
              name="firstName"
              required
              aria-invalid={Boolean(fieldErrors.firstName)}
              className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Отчество
            <input
              name="middleName"
              className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Телефон
            <input
              name="phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.currentTarget.value)}
              placeholder="+7 999 000-00-00"
              aria-invalid={Boolean(fieldErrors.phone || duplicate)}
              className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
            Дата рождения
            <input
              name="birthDate"
              type="date"
              className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 font-normal"
            />
          </label>
          {duplicate ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-3 text-sm sm:col-span-2">
              <b>Возможный дубликат</b>
              <p className="mt-1 text-[var(--color-text-secondary)]">{duplicate.fullName}</p>
              <button
                type="button"
                className="mt-2 font-semibold text-[var(--color-primary)]"
                onClick={() => onSelected(duplicate)}
              >
                Выбрать этого клиента
              </button>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-[var(--color-danger)] sm:col-span-2">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            loading={pending}
            disabled={pending || Boolean(duplicate)}
            leadingIcon={<FiPlus aria-hidden />}
            className="sm:col-span-2"
          >
            {pending ? 'Сохраняем…' : 'Создать и выбрать'}
          </Button>
        </form>
      </section>
    );
  }

  return (
    <section className="grid gap-4" aria-labelledby="constructor-client-title">
      <div>
        <h2 id="constructor-client-title" className="text-lg font-bold">
          Клиент
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Найдите существующего клиента или создайте нового прямо в договоре.
        </p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <label className="relative min-w-0">
          <span className="sr-only">Поиск клиента</span>
          <FiSearch
            aria-hidden
            className="absolute top-3.5 left-3 text-[var(--color-text-tertiary)]"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Имя или телефон"
            className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] pr-3 pl-10 text-sm"
          />
        </label>
        <Button
          type="button"
          variant="soft"
          size="sm"
          leadingIcon={<FiPlus aria-hidden />}
          onClick={() => setCreating(true)}
        >
          Создать нового
        </Button>
      </div>
      <div className="grid max-h-[46dvh] gap-2 overflow-y-auto pr-1">
        {filtered.map((client) => (
          <button
            key={client.id}
            type="button"
            aria-pressed={selectedId === client.id}
            onClick={() => onSelected(client)}
            className="flex min-h-[72px] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-left transition-colors hover:border-[var(--color-border-strong)] aria-pressed:border-[var(--color-primary)] aria-pressed:bg-[var(--color-primary-soft)]"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-elevated)] text-[var(--color-primary)]">
              <FiUser aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm">{client.fullName}</b>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {client.phone ?? 'Телефон не указан'}
              </span>
            </span>
            {selectedId === client.id ? (
              <span className="grid size-7 place-items-center rounded-full bg-[var(--color-primary)] text-white">
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
