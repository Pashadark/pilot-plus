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
            additionalPhone: '+79167654321',
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
    expect(markup).not.toContain('Готовность к аренде');
    expect(markup).not.toContain('Загрузите файл паспорта');
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
            additionalPhone: null,
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

  it('renders the selected variant-one information hierarchy and a factual client history', () => {
    const markup = renderToStaticMarkup(
      createElement(
        ToastProvider,
        null,
        createElement(ClientDetailPage, {
          canManage: false,
          canArchiveDocuments: false,
          companies: [],
          documents: [],
          comments: [
            {
              id: 'comment-1',
              rentalId: null,
              rentalLabel: null,
              authorUserId: 'user-1',
              authorName: 'Оператор',
              category: 'GENERAL',
              severity: 'INFO',
              text: 'Клиент подтвердил данные',
              isPinned: false,
              problemStatus: null,
              affectsRating: false,
              ratingDelta: null,
              resolvedAt: null,
              hiddenAt: null,
              createdAt: '2026-09-08T09:30:00.000Z',
              updatedAt: '2026-09-08T09:30:00.000Z',
            },
          ],
          rentalWorkspace: {
            summary: { total: 1, active: 0, completed: 1, totalMinor: '2500000' },
            rentals: [
              {
                id: 'rental-1',
                contractNumber: 'ME-2026-0034-TY',
                status: 'COMPLETED',
                startsAt: '2026-09-03T10:00:00.000Z',
                endsAt: '2026-09-08T10:00:00.000Z',
                billableDays: 5,
                totalPriceMinor: '2500000',
                depositMinor: '1000000',
                currency: 'RUB',
                vehicle: { label: 'Volkswagen Polo', registrationNumber: 'Р400АМ997' },
                documents: [],
                operations: [
                  {
                    id: 'return-1',
                    type: 'RETURN',
                    occurredAt: '2026-09-08T10:05:00.000Z',
                    mileageKm: null,
                    fuelLevelPercent: null,
                    evidenceStatus: 'MISSING',
                    evidenceMissingReason: null,
                    actorName: 'Оператор',
                  },
                ],
              },
            ],
          },
          client: {
            id: 'client-1',
            companyId: 'company-1',
            fullName: 'Савина Дарья Сергеевна',
            firstName: 'Дарья',
            middleName: 'Сергеевна',
            lastName: 'Савина',
            email: null,
            phone: '79069446249',
            additionalPhone: '79167654321',
            phoneMasked: '+7 ••• •••-62-49',
            passport: null,
            passportMasked: null,
            passportSeries: '0120',
            passportNumber: '693015',
            passportIssuedBy: 'ГУ МВД России по Алтайскому краю',
            passportIssuedAt: '2020-07-23',
            passportDivisionCode: '220-040',
            registrationAddress: 'Алтайский край, г. Бийск, ул. Ленинградская, д. 35, кв. 45',
            actualAddress: null,
            driverLicense: '9951952484',
            driverLicenseMasked: null,
            driverLicenseIssuedAt: '2026-07-15T00:00:00.000Z',
            driverLicenseExpiresAt: '2034-07-15T00:00:00.000Z',
            birthDate: '2006-07-23T00:00:00.000Z',
            status: 'VERIFYING',
            createdAt: '2026-09-08T08:00:00.000Z',
            updatedAt: '2026-09-08T08:00:00.000Z',
            localPhotoUrl: null,
            telegramUrl: null,
            fineSummary: { total: 0, paidAmountMinor: '0' },
            rentalSummary: { total: 1, active: 0, current: null, last: null },
          },
        }),
      ),
    );

    expect(markup).toContain('Дополнительный телефон');
    expect(markup).toContain('Паспорт РФ');
    expect(markup).toContain('Водительское удостоверение');
    expect(markup).toContain('Адрес регистрации');
    expect(markup).toContain('История клиента');
    expect(markup).toContain('Карточка клиента создана');
    expect(markup).toContain('Автомобиль возвращён');
    expect(markup).toContain('Клиент подтвердил данные');
    expect(markup).not.toContain('Паспорт (как в базе)');
  });
});
