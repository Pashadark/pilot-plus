// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ToastProvider } from '@/shared/providers/ToastProvider';

import { RentalWizard } from './RentalWizard';

describe('RentalWizard', () => {
  afterEach(cleanup);

  it('starts with an accessible Russian six-step draft and blocks confirmation', () => {
    render(
      createElement(
        ToastProvider,
        null,
        createElement(RentalWizard, {
          client: {
            id: 'client-1',
            companyId: 'company-1',
            fullName: 'Анна Воронова',
            phone: '+79991234567',
            passport: '0000 000000',
            driverLicense: '0000 000000',
            driverLicenseExpiresAt: '2027-01-01T00:00:00.000Z',
          },
          templateVersionId: 'template-1',
          vehicles: [
            {
              id: 'vehicle-1',
              label: 'Volkswagen Polo А000АА',
              dailyMinor: 250000,
              available: true,
              reasons: [],
            },
          ],
        }),
      ),
    );

    expect(screen.getByRole('heading', { name: 'Новый договор аренды' })).toBeTruthy();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' && element.textContent?.includes('Шаг 1 из 6') === true,
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Подтвердить и занять автомобиль' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('heading', { name: 'Клиент' })).toBeTruthy();
  });

  it('explains why an unavailable vehicle cannot be selected', () => {
    render(
      createElement(
        ToastProvider,
        null,
        createElement(RentalWizard, {
          client: {
            id: 'client-1',
            companyId: 'company-1',
            fullName: 'Анна Воронова',
            phone: '+79991234567',
            passport: '0000 000000',
            driverLicense: '0000 000000',
            driverLicenseExpiresAt: null,
          },
          templateVersionId: 'template-1',
          vehicles: [
            {
              id: 'vehicle-1',
              label: 'Volkswagen Polo А000АА',
              dailyMinor: 250000,
              available: false,
              reasons: ['Занят подтверждённой арендой'],
            },
          ],
        }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    expect(screen.getByRole('option', { name: /Занят подтверждённой арендой/u })).toHaveProperty(
      'disabled',
      true,
    );
  });
});
