// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  RentalCalendar: () => null,
  RentalListPage: ({ rentals }: { rentals: Array<{ agreementType?: string }> }) => (
    <div data-testid="rental-agreement-type">{rentals[0]?.agreementType}</div>
  ),
  listFilteredRentalsForCurrentUser: vi.fn(),
}));

vi.mock('@/shared/components/app-shell/AppShell', () => ({ AppShell: mocks.AppShell }));
vi.mock('@/modules/rentals/components/RentalCalendar', () => ({
  RentalCalendar: mocks.RentalCalendar,
}));
vi.mock('@/modules/rentals/components/RentalListPage', () => ({
  RentalListPage: mocks.RentalListPage,
}));
vi.mock('@/modules/rentals/server/queries', () => ({
  listFilteredRentalsForCurrentUser: mocks.listFilteredRentalsForCurrentUser,
}));

import RentalsPage from './page';

describe('RentalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listFilteredRentalsForCurrentUser.mockResolvedValue([
      {
        id: 'rental-lease-to-own',
        startsAt: new Date('2026-08-15T21:00:00.000Z'),
        endsAt: new Date('2027-08-31T21:00:00.000Z'),
        completedAt: null,
        status: 'ACTIVE',
        agreementType: 'LEASE_TO_OWN',
        contractNumber: 'ME-2026-0008-SV',
        totalPriceMinor: BigInt(9_600_000),
        depositMinor: BigInt(3_000_000),
        currency: 'RUB',
        operations: [],
        payments: [],
        documentVersions: [],
        vehicle: {
          id: 'vehicle-1',
          make: 'Kia',
          modelName: 'K5',
          model: 'Kia K5',
          registrationNumber: 'В342НР797',
          internalNumber: 'CAR-005',
          city: 'Москва',
          images: [],
        },
        client: {
          id: 'client-1',
          lastName: 'Седов',
          firstName: 'Вадим',
          middleName: 'Алексеевич',
          phoneEncrypted: null,
        },
      },
    ]);
  });

  it('передаёт тип договора с правом выкупа в табличный список', async () => {
    render(await RentalsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId('rental-agreement-type').textContent).toBe('LEASE_TO_OWN');
  });
});
