// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  RentalDetailPanel: ({ source }: { source?: string }) => (
    <div data-testid="rental-detail-panel">{source}</div>
  ),
  RentalDetailWorkspace: ({ detail }: { detail: { id: string } }) => (
    <div data-testid="rental-detail-workspace">{detail.id}</div>
  ),
  RentalSettlementCard: ({ rentalId }: { rentalId: string }) => (
    <div data-testid="rental-settlement-card">{rentalId}</div>
  ),
  getRentalDetailForCurrentUser: vi.fn(),
  listRentalAuditForCurrentUser: vi.fn(),
  rentalDetailPresentation: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('@/shared/components/app-shell/AppShell', () => ({ AppShell: mocks.AppShell }));
vi.mock('@/modules/rentals/components/RentalDetailPanel', () => ({
  RentalDetailPanel: mocks.RentalDetailPanel,
}));
vi.mock('@/modules/rentals/components/RentalDetailWorkspace', () => ({
  RentalDetailWorkspace: mocks.RentalDetailWorkspace,
}));
vi.mock('@/modules/rentals/settlement/components/RentalSettlementCard', () => ({
  RentalSettlementCard: mocks.RentalSettlementCard,
}));
vi.mock('@/modules/rentals/server/queries', () => ({
  getRentalDetailForCurrentUser: mocks.getRentalDetailForCurrentUser,
  listRentalAuditForCurrentUser: mocks.listRentalAuditForCurrentUser,
}));
vi.mock('@/modules/rentals/components/rental-detail-presentation', () => ({
  rentalDetailPresentation: mocks.rentalDetailPresentation,
}));

import Loading from './loading';
import RentalDetail from './page';

const rental = {
  id: 'rental-1',
  companyId: 'company-1',
  clientId: 'client-1',
  vehicleId: 'vehicle-1',
  contractNumber: 'ME-2026-0001-BK',
  status: 'COMPLETED',
  snapshot: {},
  client: { lastName: 'Барышева', firstName: 'Кристина', middleName: 'Олеговна' },
  vehicle: { make: 'Kia', modelName: "Cee'd", registrationNumber: 'А429АУ997' },
  startsAt: new Date('2026-08-11T21:00:00.000Z'),
  endsAt: new Date('2026-08-13T21:00:00.000Z'),
  createdAt: new Date('2026-08-01T12:00:00.000Z'),
  updatedAt: new Date('2026-08-14T12:00:00.000Z'),
  confirmedAt: null,
  activatedAt: null,
  completedAt: new Date('2026-08-14T12:00:00.000Z'),
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
  operations: [],
  depositLedgerEntries: [],
  documentVersions: [],
  documentGenerations: [],
  payments: [],
  signatures: [],
  canEdit: false,
};

describe('RentalDetail route states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRentalDetailForCurrentUser.mockResolvedValue(rental);
    mocks.listRentalAuditForCurrentUser.mockResolvedValue([]);
    mocks.rentalDetailPresentation.mockReturnValue({
      id: 'rental-1',
      source: { label: 'Импортированный договор' },
    });
  });

  it('подключает полный рабочий экран и передаёт источник в документы', async () => {
    render(await RentalDetail({ params: Promise.resolve({ id: 'rental-1' }) }));

    expect(screen.getByTestId('rental-detail-workspace').textContent).toContain('rental-1');
    expect(screen.getByTestId('rental-detail-panel').textContent).toContain(
      'Импортированный договор',
    );
    expect(screen.getByTestId('rental-settlement-card').textContent).toContain('rental-1');
    expect(screen.queryByText('Условия выдачи')).toBeNull();
  });

  it('останавливает страницу отсутствующего договора через notFound', async () => {
    mocks.getRentalDetailForCurrentUser.mockResolvedValue(null);

    await expect(RentalDetail({ params: Promise.resolve({ id: 'missing' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(mocks.listRentalAuditForCurrentUser).not.toHaveBeenCalled();
  });

  it('показывает скелетон, повторяющий геометрию детального экрана', () => {
    render(<Loading />);

    expect(screen.getByLabelText('Загрузка договора аренды')).toBeTruthy();
    expect(screen.getAllByTestId('rental-detail-skeleton-card')).toHaveLength(8);
  });
});
