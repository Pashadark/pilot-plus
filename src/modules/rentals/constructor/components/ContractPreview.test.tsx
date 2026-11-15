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
    expect(screen.getByText('Щапова Анна Петровна')).toBeTruthy();
    expect(screen.getAllByText('Не заполнено')).toHaveLength(3);
  });
});
