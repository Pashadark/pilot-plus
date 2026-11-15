// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ContractPreview } from './ContractPreview';

afterEach(cleanup);

describe('ContractPreview', () => {
  it('renders real values and explicit blanks as a readable document', () => {
    render(
      <ContractPreview
        preview={{
          city: 'Москва',
          companyName: 'СУПА ПРО Москва',
          date: '2026-11-15',
          client: { fullName: 'Щапова Анна Петровна', phone: 'Не заполнено' },
          vehicle: {
            label: 'Toyota Camry',
            registrationNumber: 'Р957АН997',
            vin: 'Не заполнено',
          },
          rental: {
            startsAt: '2026-11-20T10:00',
            endsAt: '2026-11-22T10:00',
            totalMinor: 600_000,
            depositMinor: 1_500_000,
            pickupAddress: 'Москва',
            returnAddress: 'Москва',
            territory: 'Москва и Московская область',
            conditions: 'Не заполнено',
          },
        }}
      />,
    );

    expect(screen.getByRole('article', { name: 'Документ договора' })).toBeTruthy();
    expect(screen.getAllByText('Щапова Анна Петровна').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Не заполнено').length).toBeGreaterThanOrEqual(3);
    expect(document.querySelectorAll('[data-contract-page]')).toHaveLength(13);
    expect(
      screen.getAllByText('Договор проката транспортного средства (без экипажа)').length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('11. Реквизиты и подписи сторон')).toBeTruthy();
    expect(screen.getByText('Приложение № 1')).toBeTruthy();
    expect(screen.getAllByText('Штрафы').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('28.')).toBeTruthy();
  });
});
