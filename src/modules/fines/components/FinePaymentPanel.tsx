'use client';

import { useActionState } from 'react';
import { FiCreditCard, FiRefreshCw } from 'react-icons/fi';
import { FinePaymentQr } from './FinePaymentQr';

import { checkFinePaymentAction, createSandboxFineInvoiceAction } from '../server/payment-actions';
import { Alert, Badge, Button, Card, CardContent, CardHeader } from '@/shared/ui';

export interface PayableFineSelection {
  id: string;
  decreeNumber: string;
  currentAmountMinor: string;
}

function money(minor: string) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: Number(BigInt(minor) % BigInt(100) !== BigInt(0)) ? 2 : 0,
  }).format(Number(BigInt(minor)) / 100);
}

export function FinePaymentPanel({
  companyId,
  selectedFines,
}: {
  companyId: string;
  selectedFines: readonly PayableFineSelection[];
}) {
  const [checkState, checkAction, checking] = useActionState(checkFinePaymentAction, null);
  const [invoiceState, invoiceAction, creating] = useActionState(
    createSandboxFineInvoiceAction,
    null,
  );
  const selectionTotal = selectedFines
    .reduce((total, fine) => total + BigInt(fine.currentAmountMinor), BigInt(0))
    .toString();
  const amounts = checkState && checkState.ok ? checkState : null;

  return (
    <Card aria-label="Тестовая оплата штрафов" className="min-w-0 border-[var(--color-primary)]">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            <FiCreditCard aria-hidden="true" /> Тестовая оплата
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Сначала проверьте сумму, затем создайте счёт в изолированной песочнице.
          </p>
        </div>
        <Badge tone="warning" size="md">
          Тестовая оплата — деньги не списываются
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-3 text-sm">
          <p className="font-semibold">Выбрано штрафов: {selectedFines.length}</p>
          <ul className="mt-2 grid gap-1 text-[var(--color-text-secondary)]">
            {selectedFines.map((fine) => (
              <li key={fine.id} className="flex min-w-0 justify-between gap-3">
                <span className="break-all">{fine.decreeNumber}</span>
                <span className="shrink-0 font-medium tabular-nums">
                  {money(fine.currentAmountMinor)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t pt-3 font-semibold">
            По постановлениям: {money(selectionTotal)}
          </p>
        </div>

        <form action={checkAction} className="flex flex-wrap gap-3">
          <input type="hidden" name="companyId" value={companyId} />
          {selectedFines.map((fine) => (
            <input key={fine.id} type="hidden" name="fineIds" value={fine.id} />
          ))}
          <Button
            type="submit"
            variant="outline"
            loading={checking}
            leadingIcon={<FiRefreshCw aria-hidden="true" />}
          >
            Проверить сумму
          </Button>
        </form>

        {checkState && !checkState.ok ? (
          <Alert
            tone="danger"
            title="Не удалось проверить сумму"
            description={checkState.message}
          />
        ) : null}
        {amounts ? (
          <div
            aria-live="polite"
            className="grid gap-2 rounded-[var(--radius-md)] border p-3 text-sm"
          >
            <p className="flex justify-between gap-3">
              <span>Штрафы</span>
              <strong className="tabular-nums">{money(amounts.fineAmountMinor)}</strong>
            </p>
            <p className="flex justify-between gap-3">
              <span>Комиссия</span>
              <strong className="tabular-nums">{money(amounts.commissionAmountMinor)}</strong>
            </p>
            <p className="flex justify-between gap-3 border-t pt-2 text-base">
              <span className="font-semibold">Итого</span>
              <strong className="tabular-nums">{money(amounts.totalAmountMinor)}</strong>
            </p>
          </div>
        ) : null}

        <form action={invoiceAction} className="flex flex-wrap gap-3">
          <input type="hidden" name="companyId" value={companyId} />
          {selectedFines.map((fine) => (
            <input key={fine.id} type="hidden" name="fineIds" value={fine.id} />
          ))}
          <Button
            type="submit"
            loading={creating}
            disabled={!amounts}
            title={amounts ? undefined : 'Сначала проверьте сумму'}
          >
            Создать тестовый счёт
          </Button>
        </form>

        {invoiceState && !invoiceState.ok ? (
          <Alert
            tone="danger"
            title="Не удалось создать тестовый счёт"
            description={`${invoiceState.message} Повторите проверку суммы и попробуйте снова.`}
          />
        ) : null}
        {invoiceState && invoiceState.ok ? (
          <div
            role="status"
            className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-success)] p-3 text-sm"
          >
            <p className="font-semibold">
              {invoiceState.reused ? 'Использован созданный ранее счёт.' : 'Тестовый счёт создан.'}
            </p>
            <p className="text-[var(--color-text-secondary)]">
              Статус и история платежа обновятся после ответа платёжного сервиса. Если счёт
              завершится ошибкой, повторите проверку и создание счёта.
            </p>
            {invoiceState.paymentUrl ? <FinePaymentQr url={invoiceState.paymentUrl} /> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
