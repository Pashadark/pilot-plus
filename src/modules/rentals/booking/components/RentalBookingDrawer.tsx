'use client';

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  FiArrowLeft,
  FiArrowRight,
  FiCalendar,
  FiCheck,
  FiFileText,
  FiTruck,
  FiUpload,
  FiUser,
  FiX,
} from 'react-icons/fi';

import { Drawer } from '@/shared/ui';

import { confirmBookingAction, saveBookingDraftAction } from '../server/actions';
import type { BookingClientOption, BookingVehicleOption, BookingWorkspaceData } from '../types';
import { BookingClientStep } from './BookingClientStep';
import { BookingSuccess } from './BookingSuccess';

const steps = [
  { label: 'Клиент', icon: FiUser },
  { label: 'Автомобиль', icon: FiTruck },
  { label: 'Даты и цена', icon: FiCalendar },
  { label: 'Договор и чек', icon: FiFileText },
];

function rubles(minor: number) {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(minor / 100))} ₽`;
}

function toUtc(value: string) {
  return value ? new Date(`${value}:00+03:00`).toISOString() : '';
}

function periodLabel(startsAt: string, endsAt: string) {
  if (!startsAt || !endsAt) return '';
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${formatter.format(new Date(toUtc(startsAt)))} — ${formatter.format(new Date(toUtc(endsAt)))}`;
}

export function RentalBookingDrawer({ workspace }: { workspace: BookingWorkspaceData }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [client, setClient] = useState<BookingClientOption | null>(null);
  const [vehicle, setVehicle] = useState<BookingVehicleOption | null>(null);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [rentalId, setRentalId] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('TRANSFER');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ rentalId: string; contractNumber: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const calculation = useMemo(() => {
    if (!vehicle || !startsAt || !endsAt) return null;
    const start = new Date(toUtc(startsAt));
    const end = new Date(toUtc(endsAt));
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
      return null;
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
    const overlapping = vehicle.rentalIntervals.some(
      (interval) => new Date(interval.startsAt) < end && new Date(interval.endsAt) > start,
    );
    return { days, totalMinor: days * vehicle.dailyMinor, overlapping };
  }, [endsAt, startsAt, vehicle]);

  const canContinue =
    step === 0
      ? Boolean(client)
      : step === 1
        ? Boolean(vehicle?.available && vehicle.legalReady)
        : step === 2
          ? Boolean(calculation && !calculation.overlapping)
          : true;
  const canConfirm = Boolean(
    rentalId &&
    receipt &&
    client?.documentsReady &&
    calculation &&
    !calculation.overlapping &&
    workspace.templateVersionId,
  );

  function close() {
    router.replace('/rentals?status=CONFIRMED');
    router.refresh();
  }

  function formData() {
    const data = new FormData();
    data.set('companyId', workspace.companyId);
    data.set('clientId', client?.id ?? '');
    data.set('vehicleId', vehicle?.id ?? '');
    data.set('templateVersionId', workspace.templateVersionId ?? '');
    data.set('agreementType', 'STANDARD');
    data.set('startsAt', toUtc(startsAt));
    data.set('endsAt', toUtc(endsAt));
    data.set('discountMinor', '0');
    data.set('servicesMinor', '0');
    data.set('depositMinor', String(vehicle?.depositMinor ?? 0));
    data.set('paymentTerms', 'Оплата аренды внесена при бронировании.');
    if (rentalId) data.set('rentalId', rentalId);
    return data;
  }

  function saveDraft(nextStep?: number) {
    setError('');
    startTransition(async () => {
      const result = await saveBookingDraftAction(null, formData());
      if (!result.ok) return setError(result.message);
      setRentalId(result.rentalId);
      if (typeof nextStep === 'number') setStep(nextStep);
    });
  }

  function confirm() {
    if (!receipt) return;
    setError('');
    startTransition(async () => {
      const data = formData();
      data.set('receipt', receipt);
      data.set('paymentMethod', paymentMethod);
      const result = await confirmBookingAction(null, data);
      if (!result.ok) return setError(result.message);
      setSuccess({
        rentalId: result.rentalId,
        contractNumber: result.contractNumber ?? 'Договор создан',
      });
    });
  }

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title="Новое бронирование"
      description="Создайте бронь, договор и подтверждение оплаты в одном окне."
      hideTitle
      backdropClassName="p-0 sm:p-4"
      className="m-0 ml-auto h-full max-w-[620px] overflow-hidden p-0 max-sm:max-w-none max-sm:rounded-none sm:h-[calc(100dvh-2rem)]"
    >
      <div className="flex h-full min-h-0 flex-col">
        <button
          type="button"
          aria-label="Закрыть"
          onClick={close}
          className="absolute top-4 right-4 z-10 grid size-11 place-items-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)]"
        >
          <FiX aria-hidden />
        </button>
        {success ? (
          <div className="overflow-y-auto p-5">
            <BookingSuccess
              rentalId={success.rentalId}
              contractNumber={success.contractNumber}
              vehicle={vehicle?.label ?? ''}
              period={periodLabel(startsAt, endsAt)}
              onClose={close}
            />
          </div>
        ) : (
          <>
            <ol
              aria-label="Шаги бронирования"
              className="grid grid-cols-4 gap-1 border-y border-[var(--color-border)] bg-[var(--color-elevated)]/45 px-4 py-3"
            >
              {steps.map((item, index) => {
                const Icon = item.icon;
                return (
                  <li
                    data-testid="booking-step"
                    key={item.label}
                    aria-current={step === index ? 'step' : undefined}
                    className={`grid justify-items-center gap-1 rounded-lg px-1 py-2 text-center text-[11px] font-semibold ${step === index ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : index < step ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}`}
                  >
                    <Icon aria-hidden className="text-base" />
                    <span>{item.label}</span>
                  </li>
                );
              })}
            </ol>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {step === 0 ? (
                <BookingClientStep
                  companyId={workspace.companyId}
                  clients={workspace.clients}
                  selectedId={client?.id ?? ''}
                  onSelect={setClient}
                />
              ) : null}
              {step === 1 ? (
                <section className="grid gap-4">
                  <div>
                    <h3 className="text-lg font-bold">Автомобиль</h3>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      Недоступные интервалы проверяются повторно при сохранении.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {workspace.vehicles.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setVehicle(item)}
                        disabled={!item.available || !item.legalReady}
                        aria-pressed={vehicle?.id === item.id}
                        className="grid min-h-20 grid-cols-[76px_1fr_auto] items-center gap-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-left disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-[var(--color-primary)] aria-pressed:bg-[var(--color-primary-soft)]"
                      >
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt=""
                            width={76}
                            height={64}
                            unoptimized
                            className="h-16 w-[76px] rounded-lg object-cover"
                          />
                        ) : (
                          <span className="grid h-16 w-[76px] place-items-center rounded-lg bg-[var(--color-elevated)] text-[var(--color-primary)]">
                            <FiTruck aria-hidden />
                          </span>
                        )}
                        <span>
                          <b className="block text-sm">{item.label}</b>
                          <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                            {rubles(item.dailyMinor)} в сутки
                          </span>
                        </span>
                        {vehicle?.id === item.id ? (
                          <FiCheck aria-hidden className="text-[var(--color-primary)]" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
              {step === 2 ? (
                <section className="grid gap-4">
                  <div>
                    <h3 className="text-lg font-bold">Даты и цена</h3>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      Время указано по Москве.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-semibold">
                      Выдача
                      <input
                        type="datetime-local"
                        value={startsAt}
                        onChange={(event) => setStartsAt(event.target.value)}
                        className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">
                      Возврат
                      <input
                        type="datetime-local"
                        value={endsAt}
                        onChange={(event) => setEndsAt(event.target.value)}
                        className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal"
                      />
                    </label>
                  </div>
                  {calculation ? (
                    <div
                      className={`grid gap-3 rounded-[var(--radius-md)] p-4 ${calculation.overlapping ? 'bg-[var(--color-danger-soft)]' : 'bg-[var(--color-elevated)]'}`}
                    >
                      <div className="flex justify-between text-sm">
                        <span>Срок</span>
                        <b>{calculation.days} сут.</b>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Цена за сутки</span>
                        <b>{rubles(vehicle?.dailyMinor ?? 0)}</b>
                      </div>
                      <div className="flex justify-between border-t border-[var(--color-border)] pt-3">
                        <span className="font-semibold">Итого</span>
                        <b className="text-lg">{rubles(calculation.totalMinor)}</b>
                      </div>
                      {calculation.overlapping ? (
                        <p
                          role="alert"
                          className="text-sm font-semibold text-[var(--color-danger)]"
                        >
                          Машина занята в выбранное время.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : null}
              {step === 3 ? (
                <section className="grid gap-4">
                  <div>
                    <h3 className="text-lg font-bold">Договор и оплата</h3>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      После подтверждения появится договор, а чек сохранится в приватном хранилище.
                    </p>
                  </div>
                  <div className="grid gap-2 rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-[var(--color-text-secondary)]">Клиент</span>
                      <b className="text-right">{client?.fullName}</b>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[var(--color-text-secondary)]">Автомобиль</span>
                      <b className="text-right">{vehicle?.label}</b>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[var(--color-text-secondary)]">Итого</span>
                      <b>{rubles(calculation?.totalMinor ?? 0)}</b>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[var(--color-text-secondary)]">Залог</span>
                      <b>{rubles(vehicle?.depositMinor ?? 0)} при выдаче</b>
                    </div>
                  </div>
                  {client && !client.documentsReady ? (
                    <p
                      role="alert"
                      className="rounded-[var(--radius-md)] bg-amber-50 p-3 text-sm text-amber-800"
                    >
                      Для подтверждения загрузите в карточку клиента проверенные паспорт и
                      водительское удостоверение. Черновик уже можно сохранить.
                    </p>
                  ) : null}
                  <label className="grid gap-1 text-sm font-semibold">
                    Способ оплаты
                    <select
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal"
                    >
                      <option value="TRANSFER">Перевод</option>
                      <option value="CARD">Карта</option>
                      <option value="CASH">Наличные</option>
                      <option value="OTHER">Другое</option>
                    </select>
                  </label>
                  <label className="grid cursor-pointer gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-elevated)] p-4 text-sm font-semibold">
                    <span className="inline-flex items-center gap-2 text-[var(--color-primary)]">
                      <FiUpload aria-hidden /> Фото чека
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
                      className="text-xs font-normal"
                    />
                    {receipt ? (
                      <span className="text-xs font-normal text-[var(--color-success)]">
                        Выбрано: {receipt.name}
                      </span>
                    ) : null}
                  </label>
                </section>
              ) : null}
              {error ? (
                <p
                  role="alert"
                  className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-danger-soft)] p-3 text-sm font-semibold text-[var(--color-danger)]"
                >
                  {error}
                </p>
              ) : null}
            </div>
            <footer className="grid gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-[auto_1fr_auto]">
              <button
                type="button"
                onClick={() => setStep((current) => Math.max(0, current - 1))}
                disabled={step === 0 || pending}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm font-semibold disabled:opacity-40"
              >
                <FiArrowLeft aria-hidden /> Назад
              </button>
              <button
                type="button"
                onClick={() => saveDraft()}
                disabled={!client || !vehicle || !calculation || calculation.overlapping || pending}
                className="min-h-11 rounded-[var(--radius-md)] px-4 text-sm font-semibold text-[var(--color-primary)] disabled:opacity-40"
              >
                {rentalId ? 'Черновик сохранён' : 'Сохранить черновик'}
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => (step === 2 ? saveDraft(3) : setStep((current) => current + 1))}
                  disabled={!canContinue || pending}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Далее <FiArrowRight aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirm}
                  disabled={!canConfirm || pending}
                  className="min-h-11 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {pending ? 'Создаём…' : 'Создать бронирование'}
                </button>
              )}
            </footer>
          </>
        )}
      </div>
    </Drawer>
  );
}
