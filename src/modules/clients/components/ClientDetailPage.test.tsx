import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ToastProvider } from '@/shared/providers/ToastProvider';

import { ClientDetailPage } from './ClientDetailPage';

describe('ClientDetailPage', () => {
  it('integrates the real document workspace without the former fictional message', () => {
    const markup = renderToStaticMarkup(
      createElement(
        ToastProvider,
        null,
        createElement(ClientDetailPage, {
          canManage: false,
          canArchiveDocuments: false,
          companies: [],
          documents: [],
          client: {
            id: 'client-1',
            companyId: 'company-1',
            fullName: 'Анна Воронова',
            firstName: 'Анна',
            middleName: null,
            lastName: 'Воронова',
            email: null,
            phone: '+79991234567',
            phoneMasked: '+7 ••• •••-45-67',
            passport: null,
            passportMasked: null,
            driverLicense: null,
            driverLicenseMasked: null,
            driverLicenseIssuedAt: null,
            driverLicenseExpiresAt: null,
            birthDate: null,
            status: 'NEW',
            createdAt: '2026-08-04T00:00:00.000Z',
            updatedAt: '2026-08-04T00:00:00.000Z',
            localPhotoUrl: null,
            telegramUrl: null,
            fineSummary: { total: 0, paidAmountMinor: '0' },
            rentalSummary: { total: 0, active: 0, current: null, last: null },
          },
        }),
      ),
    );
    expect(markup).toContain('Файлы и фотография');
    expect(markup).toContain('Документы пока не загружены');
    expect(markup).not.toContain('Файлы документов ещё не загружаются');
    expect(markup).toContain('Готовность к аренде');
    expect(markup).toContain('Загрузите файл паспорта');
  });

  it('keeps the staff-only reliability explanation out of a non-staff detail surface', () => {
    const markup = renderToStaticMarkup(
      createElement(
        ToastProvider,
        null,
        createElement(ClientDetailPage, {
          canManage: false,
          canArchiveDocuments: false,
          companies: [],
          documents: [],
          comments: [],
          client: {
            id: 'client-1',
            companyId: 'company-1',
            fullName: 'Анна Воронова',
            firstName: 'Анна',
            middleName: null,
            lastName: 'Воронова',
            email: null,
            phone: '+79991234567',
            phoneMasked: '+7 ••• •••-45-67',
            passport: null,
            passportMasked: null,
            driverLicense: null,
            driverLicenseMasked: null,
            driverLicenseIssuedAt: null,
            driverLicenseExpiresAt: null,
            birthDate: null,
            status: 'NEW',
            createdAt: '2026-08-04T00:00:00.000Z',
            updatedAt: '2026-08-04T00:00:00.000Z',
            localPhotoUrl: null,
            telegramUrl: null,
            fineSummary: { total: 0, paidAmountMinor: '0' },
            rentalSummary: { total: 0, active: 0, current: null, last: null },
          },
          rating: {
            score: 84,
            stars: 4,
            display: '4,2',
            label: 'Надёжный клиент',
            completedRentals: 2,
            eventCount: 1,
            openProblemCount: 1,
            events: [],
          },
        }),
      ),
    );
    expect(markup).not.toContain('Рейтинг и заметки');
  });
});
