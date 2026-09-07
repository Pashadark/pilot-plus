import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ClientGrid } from './ClientGrid';

describe('ClientGrid', () => {
  it('shows an accessible empty state', () => {
    const markup = renderToStaticMarkup(createElement(ClientGrid, { clients: [] }));
    expect(markup).toContain('Клиенты не найдены');
  });

  it('renders photo-first operational columns with real rental context', () => {
    const markup = renderToStaticMarkup(
      createElement(ClientGrid, {
        clients: [
          {
            id: 'client-1',
            companyId: 'company-1',
            fullName: 'Анна Воронова',
            email: null,
            phone: '+7 999 123-45-67',
            phoneMasked: '+7 ••• •••-12-34',
            passportMasked: null,
            driverLicenseMasked: null,
            driverLicenseExpiresAt: null,
            status: 'REGULAR',
            updatedAt: '2026-08-24T10:00:00.000Z',
            localPhotoUrl: null,
            telegramUrl: null,
            fineSummary: { total: 3, paidAmountMinor: '1250000' },
            rentalSummary: {
              total: 3,
              active: 1,
              current: {
                id: 'rental-3',
                contractNumber: 'ME-2026-0015-VA',
                status: 'ACTIVE',
                startsAt: '2026-08-20T10:00:00.000Z',
                endsAt: '2026-08-26T10:00:00.000Z',
                vehicle: { label: 'Kia · K5', registrationNumber: 'В342НР797' },
                totalPriceMinor: '3000000',
                depositMinor: '2000000',
                depositStatus: 'COLLECTED',
                depositReturnedAt: null,
              },
              last: {
                id: 'rental-3',
                contractNumber: 'ME-2026-0015-VA',
                status: 'ACTIVE',
                startsAt: '2026-08-20T10:00:00.000Z',
                endsAt: '2026-08-26T10:00:00.000Z',
                vehicle: { label: 'Kia · K5', registrationNumber: 'В342НР797' },
                totalPriceMinor: '3000000',
                depositMinor: '2000000',
                depositStatus: 'COLLECTED',
                depositReturnedAt: null,
              },
            },
          },
        ],
      }),
    );

    expect(markup.indexOf('client-photo')).toBeLessThan(markup.indexOf('Анна Воронова'));
    expect(markup).toContain('Машина');
    expect(markup).toContain('Стоимость аренды');
    expect(markup).toContain('Телефон');
    expect(markup).toContain('+7 999 123-45-67');
    expect(markup).toContain('Депозит');
    expect(markup).toContain('Статус депозита');
    expect(markup).toContain('Дата возврата');
    expect(markup).toContain('Штрафы');
    expect(markup).toContain('3');
    expect(markup).toContain('12 500 ₽');
    expect(markup).toContain('Kia · K5');
    expect(markup).toContain('В342НР797');
    expect(markup).toContain('Постоянный');
    expect(markup).toContain('20 000 ₽');
    expect(markup).toContain('30 000 ₽');
    expect(markup).toContain('Не возвращён');
    expect(markup).toContain('bg-[var(--color-success-soft)]');
    expect(markup).toContain('Открыть');
    expect(markup).toContain('aria-label="Открыть карточку клиента"');
    expect(markup).toContain('title="Открыть карточку клиента"');
    expect(markup).toContain('h-[72px]');
    expect(markup).toContain('size-9');
    expect(markup).toContain('text-right tabular-nums');
    expect(markup).not.toContain('class="font-bold');
  });

  it('shows the factual deposit return date in a separate column', () => {
    const markup = renderToStaticMarkup(
      createElement(ClientGrid, {
        clients: [
          {
            id: 'client-returned',
            companyId: 'company-1',
            fullName: 'Иван Петров',
            email: null,
            phone: '+7 900 111-22-33',
            phoneMasked: '+7 ••• •••-22-33',
            passportMasked: null,
            driverLicenseMasked: null,
            driverLicenseExpiresAt: null,
            status: 'VERIFIED',
            updatedAt: '2026-09-01T08:00:00.000Z',
            localPhotoUrl: null,
            telegramUrl: null,
            fineSummary: { total: 0, paidAmountMinor: '0' },
            rentalSummary: {
              total: 1,
              active: 0,
              current: null,
              last: {
                id: 'rental-returned',
                contractNumber: '031',
                status: 'COMPLETED',
                startsAt: '2026-08-25T10:00:00.000Z',
                endsAt: '2026-09-01T08:00:00.000Z',
                vehicle: { label: 'Toyota · Camry', registrationNumber: 'А123АА997' },
                totalPriceMinor: '4000000',
                depositMinor: '2000000',
                depositStatus: 'RETURNED',
                depositReturnedAt: '2026-09-01T08:15:00.000Z',
              },
            },
          },
        ],
      }),
    );

    expect(markup).toContain('Возвращён');
    expect(markup).toContain('01.09.2026, 11:15');
  });
});
