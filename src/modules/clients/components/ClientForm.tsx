'use client';

import { useActionState, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createClientAction, updateClientAction } from '../actions';
import {
  uploadClientDocumentAction,
  uploadClientPhotoAction,
} from '@/modules/client-documents/actions';
import { DocumentDropzone } from '@/modules/client-documents/components/DocumentDropzone';
import type { ClientDocumentActionState } from '@/modules/client-documents/types';
import {
  ClientDocumentAutofillDialog,
  type ClientAutofillFiles,
} from './ClientDocumentAutofillDialog';
import type { ClientActionState, ClientDetailDto, ClientStatus } from '../types';
import { Button, Card, CardContent, CardHeader, Input, Select } from '@/shared/ui';
import { useToast } from '@/shared/providers/ToastProvider';

const initialState: ClientActionState = { status: 'idle' };
const initialDocumentState: ClientDocumentActionState = { status: 'idle' };
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
  const isEditing = Boolean(client);
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [passportRegistrationFile, setPassportRegistrationFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [autofillOpen, setAutofillOpen] = useState(false);
  const clientKey = client?.id ?? 'new';
  const [phoneDraftState, setPhoneDraftState] = useState({ clientKey, value: '' });
  const phoneDraft = phoneDraftState.clientKey === clientKey ? phoneDraftState.value : '';
  const formRef = useRef<HTMLFormElement>(null);
  const submit = useCallback(
    async (previous: ClientActionState, formData: FormData) => {
      if (formData.get('intent') === 'draft') formData.set('status', 'DRAFT');
      formData.delete('intent');
      const next = await (client ? updateClientAction : createClientAction)(previous, formData);
      if (next.status === 'success') {
        if (!client && next.clientId) {
          const uploadDocument = async (
            file: File | null,
            category: 'PASSPORT' | 'DRIVER_LICENSE',
            title: string,
          ) => {
            if (!file) return null;
            const upload = new FormData();
            upload.set('clientId', next.clientId as string);
            upload.set('uploadId', crypto.randomUUID());
            upload.set('category', category);
            upload.set('title', title);
            upload.set('file', file);
            return uploadClientDocumentAction(initialDocumentState, upload);
          };
          const results = await Promise.all([
            uploadDocument(passportFile, 'PASSPORT', 'Паспорт — основной разворот'),
            uploadDocument(passportRegistrationFile, 'PASSPORT', 'Регистрация по паспорту'),
            uploadDocument(licenseFile, 'DRIVER_LICENSE', 'Водительское удостоверение'),
            photoFile
              ? (() => {
                  const upload = new FormData();
                  upload.set('clientId', next.clientId as string);
                  upload.set('uploadId', crypto.randomUUID());
                  upload.set('file', photoFile);
                  return uploadClientPhotoAction(initialDocumentState, upload);
                })()
              : null,
          ]);
          const failed = results.find((result) => result?.status === 'error');
          if (failed) {
            showToast({
              tone: 'warning',
              title: 'Клиент создан, но не все файлы загрузились',
              description: failed.message,
            });
          }
        }
        showToast({ tone: 'success', title: next.message });
        router.push(`/clients/${next.clientId}`);
      }
      return next;
    },
    [client, licenseFile, passportFile, passportRegistrationFile, photoFile, router, showToast],
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
  const applyOcrFields = (fields: Record<string, string>) => {
    for (const [name, value] of Object.entries(fields)) {
      const input = formRef.current?.elements.namedItem(name);
      if (input instanceof HTMLInputElement && value) input.value = value;
    }
  };
  const applyDocumentAutofill = (fields: Record<string, string>, files: ClientAutofillFiles) => {
    applyOcrFields(fields);
    setPassportFile(files.passportMain);
    setPassportRegistrationFile(files.passportRegistration);
    setLicenseFile(files.driverLicense);
    setStep(1);
    const count = Object.values(fields).filter(Boolean).length;
    showToast({
      tone: count > 0 ? 'success' : 'warning',
      title: count > 0 ? `Заполнено полей: ${count}` : 'Данные не распознаны',
      description:
        count > 0
          ? 'Проверьте распознанные данные перед созданием клиента.'
          : 'Фотографии прикреплены. Заполните данные вручную.',
    });
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="font-bold">{client ? 'Редактировать клиента' : 'Новый клиент'}</h2>
      </CardHeader>
      <CardContent>
        {!isEditing ? (
          <ol
            className="mb-5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"
            aria-label="Шаги формы"
          >
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
        ) : null}
        <form ref={formRef} action={formAction} className="grid gap-4">
          {client ? (
            <>
              <input type="hidden" name="clientId" value={client.id} />
              <input type="hidden" name="expectedUpdatedAt" value={client.updatedAt} />
              <input type="hidden" name="existingPhone" value={client.phone ?? ''} />
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
          <input type="hidden" name="status" value="NEW" disabled={isEditing || step === 3} />
          <fieldset hidden={!isEditing && step !== 0} className="grid gap-4">
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
                type="text"
                inputMode="tel"
                autoComplete="off"
                value={phoneDraft}
                onChange={(event) =>
                  setPhoneDraftState({ clientKey, value: event.currentTarget.value })
                }
                hint={
                  isEditing && client?.phone
                    ? `Текущий номер: ${client.phone}. Оставьте поле пустым, чтобы не менять.`
                    : undefined
                }
                error={errors?.phone}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Дополнительный телефон"
                name="additionalPhone"
                type="tel"
                defaultValue={client?.additionalPhone ?? ''}
                error={errors?.additionalPhone}
              />
              <Input
                label="Email"
                name="email"
                type="email"
                defaultValue={client?.email ?? ''}
                error={errors?.email}
              />
            </div>
          </fieldset>
          <fieldset hidden={!isEditing && step !== 1} className="grid gap-4">
            <legend className="sr-only">Документы и данные</legend>
            <Input
              label="Дата рождения"
              name="birthDate"
              type="date"
              defaultValue={dateValue(client?.birthDate)}
              error={errors?.birthDate}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Серия паспорта"
                name="passportSeries"
                inputMode="numeric"
                maxLength={4}
                defaultValue={client?.passportSeries ?? ''}
              />
              <Input
                label="Номер паспорта"
                name="passportNumber"
                inputMode="numeric"
                maxLength={6}
                defaultValue={client?.passportNumber ?? ''}
              />
              <Input
                label="Дата выдачи паспорта"
                name="passportIssuedAt"
                type="date"
                defaultValue={client?.passportIssuedAt ?? ''}
              />
              <Input
                label="Код подразделения"
                name="passportDivisionCode"
                placeholder="000-000"
                defaultValue={client?.passportDivisionCode ?? ''}
              />
            </div>
            <Input
              label="Кем выдан паспорт"
              name="passportIssuedBy"
              defaultValue={client?.passportIssuedBy ?? ''}
            />
            <Input
              label="Адрес регистрации"
              name="registrationAddress"
              defaultValue={client?.registrationAddress ?? ''}
              error={errors?.registrationAddress}
            />
            <Input
              label="Фактический адрес"
              name="actualAddress"
              defaultValue={client?.actualAddress ?? ''}
              error={errors?.actualAddress}
            />
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
          {!isEditing ? (
            <fieldset hidden={step !== 2} className="grid gap-3">
              <legend className="font-medium">Файлы</legend>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Файлы сохранятся в защищённом хранилище после создания клиента и пройдут
                антивирусную проверку. Видео не требуется.
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                <DocumentDropzone
                  id="new-client-passport"
                  label="Скан паспорта"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  hint="JPG, PNG, WebP или PDF до 15 МБ"
                  file={passportFile}
                  busy={pending}
                  onFileSelect={setPassportFile}
                />
                <DocumentDropzone
                  id="new-client-passport-registration"
                  label="Страница паспорта с регистрацией"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  hint="JPG, PNG, WebP или PDF до 15 МБ"
                  file={passportRegistrationFile}
                  busy={pending}
                  onFileSelect={setPassportRegistrationFile}
                />
                <DocumentDropzone
                  id="new-client-license"
                  label="Скан водительского удостоверения"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  hint="JPG, PNG, WebP или PDF до 15 МБ"
                  file={licenseFile}
                  busy={pending}
                  onFileSelect={setLicenseFile}
                />
                <DocumentDropzone
                  id="new-client-photo"
                  label="Фотография клиента"
                  accept=".jpg,.jpeg,.png,.webp"
                  hint="Необязательно · JPG, PNG или WebP до 15 МБ"
                  file={photoFile}
                  busy={pending}
                  onFileSelect={setPhotoFile}
                />
              </div>
            </fieldset>
          ) : null}
          <fieldset hidden={!isEditing && step !== 3} className="grid gap-4">
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
          {isEditing ? (
            <div className="flex justify-end border-t border-[var(--color-border)] pt-4">
              <Button type="submit" loading={pending}>
                {pending ? 'Сохраняем…' : 'Сохранить изменения'}
              </Button>
            </div>
          ) : (
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
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setAutofillOpen(true)}
                >
                  Автозаполнение по документам
                </Button>
                {step === 0 ? (
                  <Button
                    type="submit"
                    variant="soft"
                    disabled={pending}
                    name="intent"
                    value="draft"
                  >
                    Сохранить черновик
                  </Button>
                ) : null}
                {step < steps.length - 1 ? (
                  <Button type="button" onClick={ensureContacts} disabled={pending}>
                    Далее
                  </Button>
                ) : (
                  <Button type="submit" loading={pending}>
                    {pending ? 'Создаём и проверяем файлы…' : 'Создать клиента'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </form>
        {!isEditing ? (
          <ClientDocumentAutofillDialog
            open={autofillOpen}
            onOpenChange={setAutofillOpen}
            onApply={applyDocumentAutofill}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
