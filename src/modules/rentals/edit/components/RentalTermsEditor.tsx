'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';

import { updateRentalTermsAction, type RentalActionResult } from '@/modules/rentals/server/actions';
import { Button } from '@/shared/ui/Button';
import { Card, CardContent, CardHeader } from '@/shared/ui/Card';
import { Input, Select, Textarea } from '@/shared/ui/FormControls';

import type { RentalEditDto } from '../rental-edit-types';

function rubles(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}

export function RentalTermsEditor({ rental }: { rental: RentalEditDto }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<RentalActionResult | null, FormData>(
    updateRentalTermsAction,
    null,
  );
  const [startsAt, setStartsAt] = useState(rental.startsAt);
  const [endsAt, setEndsAt] = useState(rental.endsAt);
  const [daily, setDaily] = useState(rental.dailyRateRub);
  const [discount, setDiscount] = useState(rental.discountRub);
  const [services, setServices] = useState(rental.servicesRub);
  const total = useMemo(() => {
    const start = new Date(`${startsAt}:00+03:00`).getTime();
    const end = new Date(`${endsAt}:00+03:00`).getTime();
    const days =
      Number.isFinite(start) && Number.isFinite(end) && end > start
        ? Math.ceil((end - start) / 86_400_000)
        : 0;
    return { days, amount: Math.max(0, days * daily - discount + services) };
  }, [startsAt, endsAt, daily, discount, services]);
  useEffect(() => {
    if (state?.ok) {
      router.push(`/rentals/${state.rentalId}`);
      router.refresh();
    }
  }, [state, router]);
  return (
    <form action={action} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <input type="hidden" name="rentalId" value={rental.id} />
      <input type="hidden" name="companyId" value={rental.companyId} />
      <input type="hidden" name="updatedAt" value={rental.updatedAt} />
      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold">Договор и клиент</h2>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Номер</p>
              <p className="font-semibold">{rental.contractNumber ?? 'Черновик'}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Клиент</p>
              <p className="font-semibold">{rental.clientLabel}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Статус</p>
              <p className="font-semibold">{rental.status}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold">Автомобиль и период</h2>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Автомобиль"
              name="vehicleId"
              defaultValue={rental.vehicleId}
              required
              className="sm:col-span-2"
            >
              {rental.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.label}
                </option>
              ))}
            </Select>
            <Input
              label="Начало аренды"
              name="startsAt"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              required
            />
            <Input
              label="Плановый возврат"
              name="endsAt"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              required
            />
            <Input label="Адрес выдачи" name="pickupAddress" defaultValue={rental.pickupAddress} />
            <Input
              label="Адрес возврата"
              name="returnAddress"
              defaultValue={rental.returnAddress}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold">Стоимость, пробег и залог</h2>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Суточный тариф, ₽"
              name="dailyRateRub"
              type="number"
              min="0"
              step="0.01"
              value={daily}
              onChange={(event) => setDaily(Number(event.target.value))}
              required
            />
            <Input
              label="Залог, ₽"
              name="depositRub"
              type="number"
              min="0"
              step="0.01"
              defaultValue={rental.depositRub}
              required
            />
            <Input
              label="Скидка, ₽"
              name="discountRub"
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(event) => setDiscount(Number(event.target.value))}
              required
            />
            <Input
              label="Дополнительные услуги, ₽"
              name="servicesRub"
              type="number"
              min="0"
              step="0.01"
              value={services}
              onChange={(event) => setServices(Number(event.target.value))}
              required
            />
            <Input
              label="Включённый пробег, км/сутки"
              name="includedMileageKm"
              type="number"
              min="0"
              step="1"
              defaultValue={rental.includedMileageKm}
              required
            />
            <Input
              label="Перепробег, ₽/км"
              name="overageMileagePriceRub"
              type="number"
              min="0"
              step="0.01"
              defaultValue={rental.overageMileagePriceRub}
              required
            />
            <Input
              label="Недостающее топливо, ₽ за 1%"
              name="missingFuelPriceRub"
              type="number"
              min="0"
              step="0.01"
              defaultValue={rental.missingFuelPriceRub}
              required
            />
            <Textarea
              label="Условия оплаты"
              name="paymentTerms"
              defaultValue={rental.paymentTerms}
              className="sm:col-span-2"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold">Условия использования</h2>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Textarea
              label="Территория эксплуатации"
              name="territory"
              defaultValue={rental.territory}
            />
            <Textarea
              label="Допущенные водители"
              name="allowedDrivers"
              defaultValue={rental.allowedDrivers}
            />
          </CardContent>
        </Card>
      </div>
      <aside className="self-start xl:sticky xl:top-5">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold">Итог после изменения</h2>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Расчётных суток</p>
              <p className="text-2xl font-bold">{total.days}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Итого</p>
              <p className="text-2xl font-bold text-[var(--color-primary)]">
                {rubles(total.amount)}
              </p>
            </div>
            {rental.status !== 'DRAFT' ? (
              <p className="rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] p-3 text-sm">
                После сохранения будет создана новая версия PDF и DOCX. Старые версии сохранятся.
              </p>
            ) : null}
            {state && !state.ok ? (
              <p
                role="alert"
                className="rounded-[var(--radius-md)] bg-red-50 p-3 text-sm text-[var(--color-danger)]"
              >
                {state.message}
              </p>
            ) : null}
            <Button type="submit" loading={pending} className="w-full">
              {pending ? 'Сохраняем…' : 'Сохранить изменения'}
            </Button>
            <Link
              href={`/rentals/${rental.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] font-semibold"
            >
              Отмена
            </Link>
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}
