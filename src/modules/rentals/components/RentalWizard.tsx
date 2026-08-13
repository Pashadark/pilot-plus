'use client';

import Link from 'next/link';
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiArrowRight,
  FiCheckCircle,
  FiDownload,
  FiSave,
} from 'react-icons/fi';

import { calculateRental, moscowLocalToUtc } from '@/modules/rentals/domain/calculate-rental';
import { intervalsOverlap } from '@/modules/rentals/domain/availability';
import {
  confirmAndGenerateRentalAction,
  createRentalDraftAction,
  type RentalActionResult,
  updateRentalDraftAction,
} from '@/modules/rentals/server/actions';
import { useToast } from '@/shared/providers/ToastProvider';
import { Button, Card, CardContent, CardHeader, Input, Select } from '@/shared/ui';

export type RentalWizardVehicle = {
  id: string;
  label: string;
  dailyMinor: number;
  available: boolean;
  reasons: readonly string[];
  rentalIntervals?: readonly { startsAt: string; endsAt: string; status: string }[];
};

type Props = {
  client: {
    id: string;
    companyId: string;
    fullName: string;
    phone: string;
    passport: string | null;
    driverLicense: string | null;
    driverLicenseExpiresAt: string | null;
  };
  templateVersionId: string | null;
  vehicles: readonly RentalWizardVehicle[];
};

const stepLabels = [
  'Клиент',
  'Автомобиль',
  'Срок и место',
  'Цена и услуги',
  'Документы',
  'Проверка',
];
const initialState: RentalActionResult | null = null;
function rubles(minor: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(minor / 100);
}
function legalReady(client: Props['client'], templateVersionId: string | null) {
  return Boolean(
    templateVersionId && client.passport && client.driverLicense && client.driverLicenseExpiresAt,
  );
}

export function RentalWizard({ client, templateVersionId, vehicles }: Props) {
  const [step, setStep] = useState(0);
  const [vehicleId, setVehicleId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [discountMinor, setDiscountMinor] = useState(0);
  const [servicesMinor, setServicesMinor] = useState(0);
  const [rentalId, setRentalId] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { showToast } = useToast();
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null;
  const selectedReasons = useMemo(() => {
    if (!selectedVehicle) return [];
    if (!startsAt || !endsAt) return [...selectedVehicle.reasons];
    try {
      const period: [Date, Date] = [moscowLocalToUtc(startsAt), moscowLocalToUtc(endsAt)];
      const overlap = selectedVehicle.rentalIntervals?.some(
        (rental) =>
          (rental.status === 'CONFIRMED' || rental.status === 'ACTIVE') &&
          intervalsOverlap([new Date(rental.startsAt), new Date(rental.endsAt)], period),
      );
      return overlap
        ? [...selectedVehicle.reasons, 'Занят подтверждённой арендой']
        : [...selectedVehicle.reasons];
    } catch {
      return [...selectedVehicle.reasons];
    }
  }, [endsAt, selectedVehicle, startsAt]);
  const selectedAvailable = Boolean(selectedVehicle?.available && selectedReasons.length === 0);
  const calculation = useMemo(() => {
    if (!selectedVehicle || !startsAt || !endsAt) return null;
    try {
      return calculateRental({
        startsAt: moscowLocalToUtc(startsAt),
        endsAt: moscowLocalToUtc(endsAt),
        dailyMinor: selectedVehicle.dailyMinor,
        discountMinor,
        serviceMinor: servicesMinor,
      });
    } catch {
      return null;
    }
  }, [discountMinor, endsAt, selectedVehicle, servicesMinor, startsAt]);
  const ready = Boolean(selectedAvailable && calculation && legalReady(client, templateVersionId));
  const saveAction = useCallback(
    (previous: RentalActionResult | null, formData: FormData) =>
      rentalId
        ? updateRentalDraftAction(previous, formData)
        : createRentalDraftAction(previous, formData),
    [rentalId],
  );
  const [draftState, draftFormAction, saving] = useActionState(saveAction, initialState);
  const [confirmState, confirmFormAction, confirming] = useActionState(
    confirmAndGenerateRentalAction,
    initialState,
  );

  useEffect(() => {
    if (!draftState) return;
    if (draftState.ok) {
      setRentalId(draftState.rentalId);
      showToast({ tone: 'success', title: 'Черновик договора сохранён.' });
    } else showToast({ tone: 'danger', title: draftState.message });
  }, [draftState, showToast]);
  useEffect(() => {
    if (!confirmState) return;
    showToast({
      tone: confirmState.ok ? 'success' : 'danger',
      title: confirmState.ok ? 'Договор подтверждён, документы готовы.' : confirmState.message,
    });
  }, [confirmState, showToast]);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function next() {
    const error =
      step === 1 && !selectedVehicle
        ? 'Выберите автомобиль.'
        : step === 1 && !selectedAvailable
          ? 'Этот автомобиль недоступен для аренды.'
          : step === 2 && !calculation
            ? 'Укажите корректные московские дату и время выдачи и возврата.'
            : '';
    if (error) return setLocalError(error);
    setLocalError('');
    setStep((current) => Math.min(current + 1, stepLabels.length - 1));
  }
  const serverError =
    (!draftState?.ok && draftState?.message) || (!confirmState?.ok && confirmState?.message);
  const documentVersion = confirmState?.ok ? confirmState.documentVersion : undefined;

  return (
    <main
      className="mx-auto grid w-full max-w-5xl min-w-0 gap-5 p-4 sm:p-6"
      data-testid="rental-wizard"
    >
      <Link
        href={`/clients/${client.id}`}
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      >
        <FiArrowLeft aria-hidden="true" />К карточке клиента
      </Link>
      <Card>
        <CardHeader className="grid min-w-0 gap-2">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-bold tracking-tight outline-none sm:text-3xl"
          >
            Новый договор аренды
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {client.fullName} · Шаг {step + 1} из 6
          </p>
          <ol aria-label="Этапы договора" className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-6">
            {stepLabels.map((label, index) => (
              <li
                key={label}
                aria-current={index === step ? 'step' : undefined}
                className={`min-w-0 rounded-[var(--radius-sm)] px-2 py-2 ${index === step ? 'bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}
              >
                {index + 1}. {label}
              </li>
            ))}
          </ol>
        </CardHeader>
        <CardContent>
          <form action={draftFormAction} className="grid min-w-0 gap-5">
            <input type="hidden" name="companyId" value={client.companyId} />
            <input type="hidden" name="clientId" value={client.id} />
            <input type="hidden" name="vehicleId" value={vehicleId} />
            <input type="hidden" name="templateVersionId" value={templateVersionId ?? ''} />
            <input
              type="hidden"
              name="startsAt"
              value={startsAt ? moscowLocalToUtc(startsAt).toISOString() : ''}
            />
            <input
              type="hidden"
              name="endsAt"
              value={endsAt ? moscowLocalToUtc(endsAt).toISOString() : ''}
            />
            <input type="hidden" name="dailyMinor" value={selectedVehicle?.dailyMinor ?? ''} />
            <input type="hidden" name="discountMinor" value={discountMinor} />
            <input type="hidden" name="servicesMinor" value={servicesMinor} />
            {rentalId ? <input type="hidden" name="rentalId" value={rentalId} /> : null}
            {step === 0 ? (
              <section aria-labelledby="step-client">
                <h2 id="step-client" className="text-lg font-bold">
                  Клиент
                </h2>
                <dl className="mt-3 grid gap-2 rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-4 text-sm">
                  <div>
                    <dt className="text-[var(--color-text-secondary)]">ФИО</dt>
                    <dd>{client.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-secondary)]">Телефон</dt>
                    <dd>{client.phone}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-secondary)]">Реквизиты</dt>
                    <dd>
                      {client.passport && client.driverLicense
                        ? 'Заполнены'
                        : 'Нужно заполнить в карточке клиента'}
                    </dd>
                  </div>
                </dl>
              </section>
            ) : null}
            {step === 1 ? (
              <section aria-labelledby="step-vehicle" className="grid gap-4">
                <h2 id="step-vehicle" className="text-lg font-bold">
                  Автомобиль
                </h2>
                <Select
                  label="Автомобиль"
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                  required
                >
                  <option value="">Выберите автомобиль</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id} disabled={!vehicle.available}>
                      {vehicle.label}
                      {vehicle.available ? '' : ` — ${vehicle.reasons.join(', ')}`}
                    </option>
                  ))}
                </Select>
                {selectedVehicle && !selectedAvailable ? (
                  <p role="alert" className="text-sm text-[var(--color-danger)]">
                    {selectedReasons.join('. ')}
                  </p>
                ) : null}
              </section>
            ) : null}
            {step === 2 ? (
              <section aria-labelledby="step-term" className="grid gap-4">
                <h2 id="step-term" className="text-lg font-bold">
                  Срок и место выдачи
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Выдача (Москва)"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                    required
                  />
                  <Input
                    label="Возврат (Москва)"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(event) => setEndsAt(event.target.value)}
                    required
                  />
                </div>
              </section>
            ) : null}
            {step === 3 ? (
              <section aria-labelledby="step-price" className="grid gap-4">
                <h2 id="step-price" className="text-lg font-bold">
                  Цена и услуги
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Скидка, ₽"
                    type="number"
                    min="0"
                    value={discountMinor / 100}
                    onChange={(event) =>
                      setDiscountMinor(
                        Math.max(0, Math.round(Number(event.target.value) * 100) || 0),
                      )
                    }
                  />
                  <Input
                    label="Услуги, ₽"
                    type="number"
                    min="0"
                    value={servicesMinor / 100}
                    onChange={(event) =>
                      setServicesMinor(
                        Math.max(0, Math.round(Number(event.target.value) * 100) || 0),
                      )
                    }
                  />
                </div>
                {calculation ? (
                  <p className="rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] p-4 font-semibold">
                    {calculation.days} суток · {rubles(calculation.agreedTotalMinor)}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Выберите автомобиль и срок для расчёта.
                  </p>
                )}
              </section>
            ) : null}
            {step === 4 ? (
              <section aria-labelledby="step-documents" className="grid gap-3">
                <h2 id="step-documents" className="text-lg font-bold">
                  Документы и юридическая готовность
                </h2>
                <p
                  className={
                    legalReady(client, templateVersionId)
                      ? 'text-[var(--color-success)]'
                      : 'text-[var(--color-danger)]'
                  }
                >
                  {legalReady(client, templateVersionId)
                    ? 'Паспорт, водительское удостоверение и версия договора готовы.'
                    : 'Не хватает обязательных реквизитов клиента или опубликованной версии договора.'}
                </p>
              </section>
            ) : null}
            {step === 5 ? (
              <section aria-labelledby="step-review" className="grid gap-3">
                <h2 id="step-review" className="text-lg font-bold">
                  Проверка и подтверждение
                </h2>
                {ready ? (
                  <p className="flex items-center gap-2 text-[var(--color-success)]">
                    <FiCheckCircle aria-hidden="true" />
                    Можно подтвердить и занять автомобиль.
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-[var(--color-danger)]">
                    <FiAlertTriangle aria-hidden="true" />
                    Подтверждение доступно после заполнения всех обязательных данных.
                  </p>
                )}
                {calculation ? (
                  <p>
                    {selectedVehicle?.label} · {calculation.days} суток ·{' '}
                    {rubles(calculation.agreedTotalMinor)}
                  </p>
                ) : null}
              </section>
            ) : null}
            {localError || serverError ? (
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {localError || serverError}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setLocalError('');
                  setStep((current) => Math.max(current - 1, 0));
                }}
                disabled={step === 0 || saving || confirming}
              >
                Назад
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="submit"
                  variant="outline"
                  loading={saving}
                  leadingIcon={<FiSave aria-hidden="true" />}
                >
                  Сохранить черновик
                </Button>
                {step < 5 ? (
                  <>
                    <Button
                      type="button"
                      onClick={next}
                      trailingIcon={<FiArrowRight aria-hidden="true" />}
                    >
                      Далее
                    </Button>
                    <Button type="button" disabled>
                      Подтвердить и занять автомобиль
                    </Button>
                  </>
                ) : (
                  <Button
                    formAction={confirmFormAction}
                    type="submit"
                    disabled={!ready}
                    loading={confirming}
                  >
                    Подтвердить и занять автомобиль
                  </Button>
                )}
              </div>
            </div>
          </form>
          {documentVersion && confirmState?.ok ? (
            <div
              aria-live="polite"
              className="mt-5 grid gap-3 rounded-[var(--radius-md)] bg-[var(--color-success-soft)] p-4"
            >
              <p className="font-semibold">Файлы договора готовы.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  className="inline-flex min-h-11 items-center gap-2 text-[var(--color-primary)] hover:underline"
                  href={`/rentals/${confirmState.rentalId}/documents/${documentVersion}/DOCX`}
                >
                  <FiDownload aria-hidden="true" />
                  Скачать DOCX
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center gap-2 text-[var(--color-primary)] hover:underline"
                  href={`/rentals/${confirmState.rentalId}/documents/${documentVersion}/PDF`}
                >
                  <FiDownload aria-hidden="true" />
                  Скачать PDF
                </Link>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
