// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../server/actions', () => ({
  recordRentalPaymentAction: vi.fn(),
  returnRentalDepositAction: vi.fn(),
  setRentalSignatureAction: vi.fn(),
}));

import { RentalSettlementCard } from './RentalSettlementCard';

afterEach(cleanup);

describe('RentalSettlementCard', () => {
  it('shows money and signature readiness in the operational sequence', () => {
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
        signatures={[
          {
            party: 'CLIENT',
            status: 'SIGNED',
            signedByName: 'Анна Воронова',
            signedAt: '2026-09-05T09:10:00.000Z',
            actorName: 'Оператор',
          },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Расчёты и подписи' })).toBeTruthy();
    expect(screen.getByText('Осталось оплатить')).toBeTruthy();
    expect(screen.getByText('20 000 ₽')).toBeTruthy();
    expect(screen.getByText('Клиент подписал')).toBeTruthy();
    expect(screen.getByText('Подпись компании отсутствует')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Записать оплату' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Отметить подпись' })).toBeTruthy();
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
        signatures={[]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Подтвердить возврат залога' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Записать оплату' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Исправить оплату и подписи' })).toBeTruthy();
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
        signatures={[]}
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
        signatures={[]}
        defaultPaymentKind="DEPOSIT"
      />,
    );

    expect((screen.getByRole('combobox', { name: 'Назначение' }) as HTMLSelectElement).value).toBe(
      'DEPOSIT',
    );
  });

  it('formats signed time in Moscow identically on the server and in the browser', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'UTC';
    render(
      <RentalSettlementCard
        companyId="company-1"
        rentalId="rental-1"
        currency="RUB"
        totalPriceMinor="100000"
        depositRequiredMinor={null}
        canEdit={false}
        payments={[]}
        signatures={[
          {
            party: 'CLIENT',
            status: 'SIGNED',
            signedByName: 'Анна Воронова',
            signedAt: '2026-09-05T09:10:00.000Z',
            actorName: 'Оператор',
          },
        ]}
      />,
    );
    process.env.TZ = previousTimezone;

    expect(screen.getByText(/05\.09\.2026, 12:10:00/u)).toBeTruthy();
  });
});
