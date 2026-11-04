// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ToastProvider } from '@/shared/providers/ToastProvider';

import { RentalWizard } from './RentalWizard';

describe('RentalWizard', () => {
  afterEach(cleanup);

  it('starts with the accessible approved three-step flow', () => {
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
          element?.tagName === 'P' && element.textContent?.includes('Шаг 1 из 3') === true,
      ),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Сканируем документы клиента' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('radiogroup', { name: 'Тип аренды' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Обычная аренда' })).toHaveProperty('checked', true);
    fireEvent.click(screen.getByRole('radio', { name: 'Аренда с правом выкупа' }));
    expect(screen.getByRole('radio', { name: 'Аренда с правом выкупа' })).toHaveProperty(
      'checked',
      true,
    );
  });

  it('keeps an unavailable vehicle option compact without appending readiness blockers', () => {
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
              label: 'Skoda Karoq Х193АК997',
              dailyMinor: 250000,
              available: false,
              reasons: ['Автомобиль на техническом обслуживании'],
              readiness: {
                ready: false,
                blockers: [
                  {
                    code: 'VEHICLE_VIN_MISSING',
                    message: 'Укажите VIN.',
                    href: '/vehicles/vehicle-1/edit',
                    severity: 'BLOCKER',
                  },
                  {
                    code: 'VEHICLE_OSAGO_MISSING',
                    message: 'Заполните данные ОСАГО.',
                    href: '/vehicles/vehicle-1/edit',
                    severity: 'BLOCKER',
                  },
                ],
                warnings: [],
              },
            },
          ],
        }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    expect(screen.getByRole('option', { name: 'Skoda Karoq Х193АК997 — на ТО' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.queryByRole('option', { name: /Укажите VIN/u })).toBeNull();
    expect(screen.queryByRole('option', { name: /ОСАГО/u })).toBeNull();
  });

  it('allows a legally incomplete vehicle to be selected for a draft', () => {
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
            documentsReady: true,
          },
          templateVersionId: 'template-1',
          vehicles: [
            {
              id: 'vehicle-1',
              label: 'Volkswagen Polo А000АА',
              dailyMinor: 250000,
              available: true,
              reasons: [],
              legalReady: false,
              readiness: {
                ready: false,
                blockers: [
                  {
                    code: 'VEHICLE_OSAGO_MISSING',
                    message: 'Заполните данные ОСАГО.',
                    href: '/vehicles/vehicle-1/edit#insurance',
                    severity: 'BLOCKER',
                  },
                ],
                warnings: [],
              },
            },
          ],
        }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    const option = screen.getByRole('option', { name: 'Volkswagen Polo А000АА' });
    expect(option).toHaveProperty('disabled', false);
    fireEvent.change(screen.getByRole('combobox', { name: 'Автомобиль' }), {
      target: { value: 'vehicle-1' },
    });
    expect(screen.getByRole('combobox', { name: 'Автомобиль' })).toHaveProperty(
      'value',
      'vehicle-1',
    );
  });

  it('shows correction links in the contract preflight', () => {
    const { container } = render(
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
            documentsReady: false,
          },
          templateVersionId: null,
          vehicles: [
            {
              id: 'vehicle-1',
              label: 'Volkswagen Polo А000АА',
              dailyMinor: 250000,
              available: true,
              reasons: [],
              legalReady: true,
              readiness: { ready: true, blockers: [], warnings: [] },
            },
          ],
        }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Автомобиль' }), {
      target: { value: 'vehicle-1' },
    });
    const dateInputs = container.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    fireEvent.change(dateInputs[0]!, {
      target: { value: '2026-09-03T10:00' },
    });
    fireEvent.change(dateInputs[1]!, {
      target: { value: '2026-09-05T10:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));

    expect(
      screen.getByRole('heading', { name: 'Документы и юридическая готовность' }),
    ).toBeTruthy();
    expect(
      screen
        .getAllByRole('link', { name: 'Загрузите паспорт и водительское удостоверение.' })[0]
        .getAttribute('href'),
    ).toBe('/clients/client-1?tab=documents');
    expect(
      screen.getAllByRole('link', { name: 'Опубликуйте шаблон договора.' })[0].getAttribute('href'),
    ).toBe('/admin');
  });
});
