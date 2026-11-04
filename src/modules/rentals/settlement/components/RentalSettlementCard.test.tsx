// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../server/actions', () => ({
  recordRentalPaymentAction: vi.fn(),
  returnRentalDepositAction: vi.fn(),
}));

import { RentalSettlementCard } from './RentalSettlementCard';

afterEach(cleanup);

describe('RentalSettlementCard', () => {
  it('shows money without a duplicate signature status for an existing contract', () => {
    render(
      <RentalSettlementCard
        companyId="company-1"
        rentalId="rental-1"
        currency="RUB"
        totalPriceMinor="3200000"
        depositRequiredMinor="1000000"
        canEdit
        payments={[
          {
            id: 'payment-1',
            kind: 'RENT',
            status: 'CONFIRMED',
            amountMinor: '1200000',
            method: 'TRANSFER',
            recordedAt: '2026-09-05T09:00:00.000Z',
            actorName: 'Оператор',
          },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Расчёты' })).toBeTruthy();
    expect(screen.getByText('Осталось оплатить')).toBeTruthy();
    expect(screen.getByText('20 000 ₽')).toBeTruthy();
    expect(screen.queryByText(/Подпись/u)).toBeNull();
    expect(screen.getByRole('button', { name: 'Записать оплату' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Отметить подпись' })).toBeNull();
    expect((screen.getByRole('combobox', { name: 'Назначение' }) as HTMLSelectElement).value).toBe(
      'RENT',
    );
  });

  it('shows a separate deposit return action and hides correction forms for a completed rental', () => {
    render(
      <RentalSettlementCard
        companyId="company-1"
        rentalId="rental-1"
        currency="RUB"
        totalPriceMinor="100000"
        depositRequiredMinor="3000000"
        canEdit
        rentalStatus="COMPLETED"
        payments={[
          {
            id: 'deposit-1',
            kind: 'DEPOSIT',
            status: 'CONFIRMED',
            amountMinor: '3000000',
            method: 'CASH',
            recordedAt: '2026-09-05T09:00:00.000Z',
            actorName: 'Оператор',
          },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Подтвердить возврат залога' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Записать оплату' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Исправить оплату' })).toBeTruthy();
  });

  it('hides mutation forms from a read-only user', () => {
    render(
      <RentalSettlementCard
        companyId="company-1"
        rentalId="rental-1"
        currency="RUB"
        totalPriceMinor="100000"
        depositRequiredMinor={null}
        canEdit={false}
        payments={[]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Записать оплату' })).toBeNull();
  });

  it('opens the payment form with deposit selected from the direct action link', () => {
    render(
      <RentalSettlementCard
        companyId="company-1"
        rentalId="rental-1"
        currency="RUB"
        totalPriceMinor="100000"
        depositRequiredMinor="50000"
        canEdit
        payments={[]}
        defaultPaymentKind="DEPOSIT"
      />,
    );

    expect((screen.getByRole('combobox', { name: 'Назначение' }) as HTMLSelectElement).value).toBe(
      'DEPOSIT',
    );
  });

});
