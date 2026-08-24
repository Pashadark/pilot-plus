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
            phoneMasked: '+7 ••• •••-12-34',
            passportMasked: null,
            driverLicenseMasked: null,
            driverLicenseExpiresAt: null,
            status: 'REGULAR',
            updatedAt: '2026-08-24T10:00:00.000Z',
            localPhotoUrl: null,
            telegramUrl: null,
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
    expect(markup).toContain('Депозит');
    expect(markup).toContain('Статус депозита');
    expect(markup).toContain('Kia · K5');
    expect(markup).toContain('В342НР797');
    expect(markup).toContain('Постоянный');
    expect(markup).toContain('20 000 ₽');
    expect(markup).toContain('30 000 ₽');
    expect(markup).toContain('Нужно вернуть');
    expect(markup).toContain('bg-[var(--color-success-soft)]');
    expect(markup).toContain('Открыть');
  });
});
