'use client';

import { useActionState, useState } from 'react';
import { FiCreditCard } from 'react-icons/fi';

import { Button, Card, CardContent, CardHeader, Input, Select } from '@/shared/ui';

import {
  recordRentalPaymentAction,
  returnRentalDepositAction,
  type SettlementActionResult,
} from '../server/actions';

type Payment = {
  id: string;
  kind: 'RENT' | 'DEPOSIT';
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  amountMinor: string;
  method: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
  recordedAt: string;
  actorName: string;
};

type Props = {
  companyId: string;
  rentalId: string;
  currency: string;
  totalPriceMinor: string;
  depositRequiredMinor: string | null;
  canEdit: boolean;
  rentalStatus?: 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  depositResolved?: boolean;
  payments: readonly Payment[];
  defaultPaymentKind?: 'RENT' | 'DEPOSIT';
};

const initialState: SettlementActionResult | null = null;

function money(value: bigint, currency: string) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value) / 100);
}

export function RentalSettlementCard(props: Props) {
  const [showCorrections, setShowCorrections] = useState(false);
  const [paymentState, paymentAction, paymentPending] = useActionState(
    recordRentalPaymentAction,
    initialState,
  );
  const [depositState, depositAction, depositPending] = useActionState(
    returnRentalDepositAction,
    initialState,
  );
  const confirmedRent = props.payments
    .filter((payment) => payment.kind === 'RENT' && payment.status === 'CONFIRMED')
    .reduce((sum, payment) => sum + BigInt(payment.amountMinor), BigInt(0));
  const returnedRent = props.payments
    .filter(
      (payment) =>
        payment.kind === 'RENT' &&
        (payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED'),
    )
    .reduce((sum, payment) => sum + BigInt(payment.amountMinor), BigInt(0));
  const paid = confirmedRent - returnedRent;
  const remaining =
    BigInt(props.totalPriceMinor) > paid ? BigInt(props.totalPriceMinor) - paid : BigInt(0);
  const depositCollected = props.payments
    .filter((payment) => payment.kind === 'DEPOSIT' && payment.status === 'CONFIRMED')
    .reduce((sum, payment) => sum + BigInt(payment.amountMinor), BigInt(0));
  const isOperational = props.rentalStatus === 'ACTIVE' || props.rentalStatus === 'COMPLETED';
  const showMutationForms = props.canEdit && (!isOperational || showCorrections);
  const canResolveDeposit =
    props.canEdit &&
    isOperational &&
    depositCollected > BigInt(0) &&
    !props.depositResolved;

  return (
    <Card id="rental-settlement" className="scroll-mt-5">
      <CardHeader className="grid gap-1">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <FiCreditCard aria-hidden="true" />
          Расчёты
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Фактическое состояние оплаты и залога по договору.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Оплачено" value={money(paid, props.currency)} />
          <Metric label="Осталось оплатить" value={money(remaining, props.currency)} />
          <Metric
            label="Залог внесён"
            value={`${money(depositCollected, props.currency)} / ${money(BigInt(props.depositRequiredMinor ?? '0'), props.currency)}`}
          />
        </div>

        {canResolveDeposit ? (
          <form action={depositAction} className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-primary)]/25 bg-[var(--color-primary-soft)] p-4 sm:grid-cols-2">
            <input type="hidden" name="companyId" value={props.companyId} />
            <input type="hidden" name="rentalId" value={props.rentalId} />
            <div className="sm:col-span-2">
              <h3 className="font-semibold">Возврат залога</h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Укажите, сколько реально вернули клиенту. Если удержали часть или весь залог — причина обязательна.</p>
            </div>
            <Input label="Возвращено клиенту, ₽" name="returnedRubles" inputMode="decimal" required />
            <Input label="Причина удержания" name="reason" placeholder="Не заполняется при полном возврате" />
            {depositState ? <div className="sm:col-span-2"><ActionMessage state={depositState} /></div> : null}
            <Button type="submit" loading={depositPending} className="sm:col-span-2 sm:w-fit">
              Подтвердить возврат залога
            </Button>
          </form>
        ) : null}

        {props.canEdit && isOperational ? (
          <Button type="button" variant="secondary" className="w-fit" onClick={() => setShowCorrections((value) => !value)}>
            {showCorrections ? 'Скрыть исправления' : 'Исправить оплату'}
          </Button>
        ) : null}

        {showMutationForms ? (
          <div className="border-t pt-5">
            <form action={paymentAction} className="grid max-w-xl gap-3">
              <h3 className="font-semibold">Записать оплату</h3>
              <input type="hidden" name="companyId" value={props.companyId} />
              <input type="hidden" name="rentalId" value={props.rentalId} />
              <Select
                label="Назначение"
                name="kind"
                defaultValue={props.defaultPaymentKind ?? 'RENT'}
              >
                <option value="RENT">Аренда</option>
                <option value="DEPOSIT">Залог</option>
              </Select>
              <Input label="Сумма, ₽" name="amountRubles" inputMode="decimal" required />
              <Select label="Способ оплаты" name="method" defaultValue="TRANSFER">
                <option value="TRANSFER">Перевод</option>
                <option value="CARD">Карта</option>
                <option value="CASH">Наличные</option>
                <option value="OTHER">Другое</option>
              </Select>
              <Input label="Номер операции или комментарий" name="reference" />
              {paymentState ? <ActionMessage state={paymentState} /> : null}
              <Button type="submit" loading={paymentPending}>
                Записать оплату
              </Button>
            </form>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border p-3">
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function ActionMessage({ state }: { state: SettlementActionResult }) {
  return (
    <p
      role="status"
      className={
        state.ok ? 'text-sm text-[var(--color-success)]' : 'text-sm text-[var(--color-danger)]'
      }
    >
      {state.message}
    </p>
  );
}
