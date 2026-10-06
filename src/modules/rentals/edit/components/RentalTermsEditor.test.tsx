// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/modules/rentals/server/actions', () => ({ updateRentalTermsAction: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { RentalTermsEditor } from './RentalTermsEditor';

describe('RentalTermsEditor', () => {
  afterEach(cleanup);
  it('показывает неизменяемый клиент и все основные условия', () => {
    render(
      <RentalTermsEditor
        rental={{
          id: 'r1',
          companyId: 'c1',
          contractNumber: 'ME-2026-0001-BK',
          status: 'CONFIRMED',
          clientLabel: 'Иванов Иван',
          updatedAt: '2026-09-01T10:00:00.000Z',
          vehicleId: 'v1',
          startsAt: '2026-09-01T12:00',
          endsAt: '2026-09-03T12:00',
          dailyRateRub: 5000,
          discountRub: 0,
          servicesRub: 500,
          depositRub: 15000,
          includedMileageKm: 200,
          overageMileagePriceRub: 10,
          missingFuelPriceRub: 150,
          pickupAddress: 'Москва',
          returnAddress: 'Москва',
          paymentTerms: 'Карта',
          territory: 'РФ',
          allowedDrivers: 'Иванов',
          vehicles: [
            { id: 'v1', label: 'Kia Ceed · A429AY997', dailyRateRub: 5000, depositRub: 15000 },
          ],
        }}
      />,
    );
    expect(screen.getByText('Иванов Иван')).toBeTruthy();
    expect(screen.getByLabelText('Автомобиль *')).toBeTruthy();
    expect(screen.getByLabelText('Начало аренды *')).toBeTruthy();
    expect(screen.getByLabelText('Суточный тариф, ₽ *')).toBeTruthy();
    expect(screen.getByLabelText('Включённый пробег, км/сутки *')).toBeTruthy();
    expect(screen.getByLabelText('Перепробег, ₽/км *')).toBeTruthy();
    expect(screen.getByLabelText('Недостающее топливо, ₽ за 1% *')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeTruthy();
  });
});
