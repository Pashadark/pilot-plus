'use client';

import { useActionState, useEffect, useRef } from 'react';

import { Button, Input, Select, Textarea } from '@/shared/ui';

import { createLeadAction } from '../actions';
import type { LeadActionState } from '../types';

const initialState: LeadActionState = { status: 'idle' };

export function LeadCreateForm({
  companies,
}: {
  companies: readonly { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createLeadAction, initialState);
  useEffect(() => {
    if (state.status === 'success') formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Select label="Компания" name="companyId" error={state.fieldErrors?.companyId} required>
          {companies.length > 1 ? <option value="">Выберите компанию</option> : null}
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </Select>
        <Input
          label="Имя"
          name="name"
          autoComplete="given-name"
          error={state.fieldErrors?.name}
          required
        />
        <Input
          label="Фамилия"
          name="lastName"
          autoComplete="family-name"
          error={state.fieldErrors?.lastName}
        />
        <Input
          label="Телефон"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+7 999 123-45-67"
          error={state.fieldErrors?.phone}
          required
        />
        <Select label="Источник" name="source" defaultValue="Телефон">
          <option>Телефон</option>
          <option>Сайт</option>
          <option>Мессенджер</option>
          <option>Офис</option>
          <option>Рекомендация</option>
          <option>Авито</option>
          <option>ВКонтакте</option>
          <option>Другое</option>
        </Select>
        <Input
          label="Следующий контакт"
          name="nextContactAt"
          type="datetime-local"
          error={state.fieldErrors?.nextContactAt}
          hint="Необязательно — без времени заявка останется в рабочем дне в конце списка."
        />
      </div>
      <Textarea
        label="Комментарий"
        name="comment"
        placeholder="Что нужно клиенту, даты, предпочтения"
        error={state.fieldErrors?.comment}
      />
      {state.message ? (
        <p
          role="status"
          className={
            state.status === 'error'
              ? 'text-sm text-[var(--color-danger)]'
              : 'text-sm text-[var(--color-success)]'
          }
        >
          {state.message}
        </p>
      ) : null}
      <div>
        <Button type="submit" loading={pending}>
          {pending ? 'Сохраняем…' : 'Добавить заявку'}
        </Button>
      </div>
    </form>
  );
}
