import { describe, expect, it } from 'vitest';

import { rentalDetailPresentation, type RentalDetailInput } from './rental-detail-presentation';

const base: RentalDetailInput = {
  id: 'cmswhu2sq0001tu0ghdiulou2',
  contractNumber: 'ME-2026-0001-BK',
  status: 'COMPLETED',
  snapshot: { importedFrom: 'contracts-001-010', contractNumber: 'ME-2026-0001-BK' },
  clientId: 'client-1',
  clientLabel: 'Барышева Кристина Олеговна',
  vehicleId: 'vehicle-1',
  vehicleLabel: "Kia · Cee'd · А429АУ997",
  startsAt: '2026-08-11T21:00:00.000Z',
  endsAt: '2026-08-13T21:00:00.000Z',
  createdAt: '2026-08-11T21:00:00.000Z',
  updatedAt: '2026-08-13T21:00:00.000Z',
  confirmedAt: '2026-08-11T21:00:00.000Z',
  activatedAt: '2026-08-11T21:00:00.000Z',
  completedAt: '2026-08-13T21:00:00.000Z',
  cancelledAt: null,
  currency: 'RUB',
  dailyRateMinor: BigInt(470000),
  billableDays: 2,
  basePriceMinor: BigInt(940000),
  discountMinor: BigInt(0),
  servicesMinor: BigInt(0),
  totalPriceMinor: BigInt(940000),
  depositMinor: BigInt(1500000),
  includedMileageKm: 250,
  overageMileagePriceMinor: BigInt(1000),
  missingFuelPriceMinor: BigInt(10000),
  priceOverrideReason: null,
  drivers: [],
};

describe('rentalDetailPresentation', () => {
  it('показывает завершённый импортированный договор из реальных полей аренды', () => {
    const view = rentalDetailPresentation(base);

    expect(view.source.label).toBe('Импортированный договор');
    expect(view.status.label).toBe('Завершён');
    expect(view.finance.deposit).toBe('15 000 ₽');
    expect(view.finance.dailyRate).toBe('4 700 ₽');
    expect(view.finance.total).toBe('9 400 ₽');
    expect(view.term.billableDaysLabel).toBe('2 дня');
    expect(view.operations.includedMileage).toBe('250 км');
    expect(view.lifecycle.at(-1)?.label).toBe('Аренда завершена');
  });

  it('использует неизменяемый снимок подтверждённого договора', () => {
    const view = rentalDetailPresentation({
      ...base,
      status: 'CONFIRMED',
      snapshot: {
        client: { fullName: 'Снимок Клиента' },
        vehicle: { make: 'Снимок', model: 'Polo', registrationNumber: 'А111АА77' },
        rental: {
          startsAt: '2026-08-01T09:00:00.000Z',
          endsAt: '2026-08-02T09:00:00.000Z',
          agreedTotalMinor: 450000,
          depositMinor: 100000,
          pickupAddress: 'Снимок выдача',
          returnAddress: 'Снимок возврат',
        },
        issuance: { territory: 'Москва' },
      },
      clientLabel: 'Изменённый клиент',
      vehicleLabel: 'Изменённый автомобиль',
      totalPriceMinor: BigInt(999999),
    });

    expect(view.source.label).toBe('Снимок подтверждённого договора');
    expect(view.client.label).toBe('Снимок Клиента');
    expect(view.vehicle.label).toContain('Снимок · Polo');
    expect(view.term.startsAt).toContain('01.08.2026');
    expect(view.finance.total).toBe('4 500 ₽');
    expect(view.operations.pickupAddress).toBe('Снимок выдача');
    expect(view.operations.returnAddress).toBe('Снимок возврат');
    expect(view.operations.territory).toBe('Москва');
  });
});
