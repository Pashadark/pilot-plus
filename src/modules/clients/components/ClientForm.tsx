'use client';

import { useActionState, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createClientAction, updateClientAction } from '../actions';
import type { ClientActionState, ClientDetailDto, ClientStatus } from '../types';
import { Button, Card, CardContent, CardHeader, Input, Select } from '@/shared/ui';
import { useToast } from '@/shared/providers/ToastProvider';

const initialState: ClientActionState = { status: 'idle' };
const steps = ['Контакты', 'Документы и данные', 'Файлы', 'Проверка'];
const statusOptions: readonly { value: ClientStatus; label: string }[] = [
  { value: 'NEW', label: 'Новый' },
  { value: 'VERIFYING', label: 'На проверке' },
  { value: 'VERIFIED', label: 'Проверен' },
  { value: 'REGULAR', label: 'Постоянный' },
  { value: 'BLOCKED', label: 'Заблокирован' },
];

function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

export function ClientForm({
  companies,
  client,
}: {
  companies: readonly { id: string; name: string }[];
  client?: ClientDetailDto;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const submit = useCallback(
    async (previous: ClientActionState, formData: FormData) => {
      if (formData.get('intent') === 'draft') formData.set('status', 'DRAFT');
      formData.delete('intent');
      const next = await (client ? updateClientAction : createClientAction)(previous, formData);
      if (next.status === 'success') {
        showToast({ tone: 'success', title: next.message });
        router.push(`/clients/${next.clientId}`);
      }
      return next;
    },
    [client, router, showToast],
  );
  const [state, formAction, pending] = useActionState(submit, initialState);
  const errors = state.status === 'error' ? state.fieldErrors : undefined;
  const ensureContacts = () => {
    const fields = ['firstName', 'lastName', 'phone'];
    const valid = fields.every(
      (name) =>
        formRef.current?.elements.namedItem(name) instanceof HTMLInputElement &&
        (formRef.current.elements.namedItem(name) as HTMLInputElement).checkValidity(),
    );
    if (valid) setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="font-bold">{client ? 'Редактировать клиента' : 'Новый клиент'}</h2>
      </CardHeader>
      <CardContent>
        <ol className="mb-5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4" aria-label="Шаги формы">
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={step === index ? 'step' : undefined}
              className={`rounded-[var(--radius-md)] px-3 py-2 ${step === index ? 'bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]' : 'bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'}`}
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>
        <form ref={formRef} action={formAction} className="grid gap-4">
          {client ? (
            <>
              <input type="hidden" name="clientId" value={client.id} />
              <input type="hidden" name="expectedUpdatedAt" value={client.updatedAt} />
            </>
          ) : null}
          {client || companies.length <= 1 ? (
            <input
              type="hidden"
              name="companyId"
              value={client?.companyId ?? companies[0]?.id ?? ''}
            />
          ) : (
            <Select
              label="Компания"
              name="companyId"
              defaultValue={companies[0]?.id ?? ''}
              required
            >
              <option value="">Выберите компанию</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </Select>
          )}
          <input type="hidden" name="status" value="NEW" disabled={step === 3} />
          <fieldset hidden={step !== 0} className="grid gap-4">
            <legend className="sr-only">Контакты</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Имя"
                name="firstName"
                defaultValue={client?.firstName}
                error={errors?.firstName}
                required
              />
              <Input
                label="Фамилия"
                name="lastName"
                defaultValue={client?.lastName}
                error={errors?.lastName}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Отчество" name="middleName" defaultValue={client?.middleName ?? ''} />
              <Input
                label="Телефон"
                name="phone"
                type="tel"
                defaultValue={client?.phone}
                error={errors?.phone}
                required
              />
            </div>
            <Input
              label="Email"
              name="email"
              type="email"
              defaultValue={client?.email ?? ''}
              error={errors?.email}
            />
          </fieldset>
          <fieldset hidden={step !== 1} className="grid gap-4">
            <legend className="sr-only">Документы и данные</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Дата рождения"
                name="birthDate"
                type="date"
                defaultValue={dateValue(client?.birthDate)}
                error={errors?.birthDate}
              />
              <Input
                label="Паспорт"
                name="passport"
                defaultValue={client?.passport ?? ''}
                error={errors?.passport}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Водительское удостоверение"
                name="driverLicense"
                defaultValue={client?.driverLicense ?? ''}
                error={errors?.driverLicense}
              />
              <Input
                label="Дата выдачи ВУ"
                name="driverLicenseIssuedAt"
                type="date"
                defaultValue={dateValue(client?.driverLicenseIssuedAt)}
                error={errors?.driverLicenseIssuedAt}
              />
            </div>
            <Input
              label="Срок действия ВУ"
              name="driverLicenseExpiresAt"
              type="date"
              defaultValue={dateValue(client?.driverLicenseExpiresAt)}
              error={errors?.driverLicenseExpiresAt}
            />
          </fieldset>
          <fieldset hidden={step !== 2} className="grid gap-3">
            <legend className="font-medium">Файлы</legend>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Загрузка файлов появится в следующем этапе. Сейчас сохраняются только данные
              документов.
            </p>
            <Input label="Файл документа" type="file" disabled />
          </fieldset>
          <fieldset hidden={step !== 3} className="grid gap-4">
            <legend className="font-medium">Проверка</legend>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Проверьте контакты и документы. После сохранения откроется карточка клиента.
            </p>
            <Select
              label="Статус"
              name="status"
              defaultValue={client?.status === 'DRAFT' ? 'NEW' : (client?.status ?? 'NEW')}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </fieldset>
          {state.status === 'error' ? (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {state.message}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-between gap-2 border-t border-[var(--color-border)] pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0 || pending}
            >
              Назад
            </Button>
            <div className="flex flex-wrap gap-2">
              {step === 0 && !client ? (
                <Button type="submit" variant="soft" disabled={pending} name="intent" value="draft">
                  Сохранить черновик
                </Button>
              ) : null}
              {step < steps.length - 1 ? (
                <Button type="button" onClick={ensureContacts} disabled={pending}>
                  Далее
                </Button>
              ) : (
                <Button type="submit" loading={pending}>
                  {client ? 'Сохранить' : 'Создать клиента'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
