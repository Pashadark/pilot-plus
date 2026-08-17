// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { rentalDetailPresentation } from './rental-detail-presentation';
import { RentalDetailWorkspace } from './RentalDetailWorkspace';

vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

describe('RentalDetailWorkspace', () => {
  it('показывает полную карточку импортированной аренды в едином стиле Pilot+', () => {
    const detail = rentalDetailPresentation({
      id: 'cmswhu2sq0001tu0ghdiulou2',
      contractNumber: 'ME-2026-0001-BK',
      status: 'COMPLETED',
      snapshot: { importedFrom: 'contracts-001-010' },
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
    });

    const { container } = render(<RentalDetailWorkspace detail={detail} />);

    expect(screen.getByRole('heading', { name: 'ME-2026-0001-BK' })).toBeTruthy();
    expect(screen.getByText(/cmswhu2sq0001tu0ghdiulou2/u)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Копировать ID договора' })).toBeTruthy();
    expect(screen.getByText('Завершён')).toBeTruthy();
    expect(screen.getAllByText(/15\s000\s₽/u).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4\s700\s₽/u).length).toBeGreaterThan(0);
    expect(screen.getByText('250 км')).toBeTruthy();
    expect(screen.getByText('Аренда завершена')).toBeTruthy();
    expect(container.firstElementChild?.className).toContain('min-w-0');
    expect(container.innerHTML).not.toMatch(/COMPLETED|undefined|null/u);
  });
});
