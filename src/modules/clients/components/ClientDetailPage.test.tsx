import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ClientDetailPage } from './ClientDetailPage';

describe('ClientDetailPage', () => {
  it('shows only implemented overview and document data without a fictional upload tab', () => {
    const markup = renderToStaticMarkup(
      createElement(ClientDetailPage, {
        canManage: false,
        companies: [],
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
        },
      }),
    );
    expect(markup).toContain('Файлы документов ещё не загружаются');
    expect(markup).toContain('Документы');
  });
});
