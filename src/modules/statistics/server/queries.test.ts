import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  vehicles: vi.fn(),
  payments: vi.fn(),
  rentals: vi.fn(),
  maintenance: vi.fn(),
  wash: vi.fn(),
  visits: vi.fn(),
  firstRental: vi.fn(),
  firstPayment: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/modules/rentals/server/access', () => ({ getRentalAccess: mocks.access }));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    vehicle: { findMany: mocks.vehicles },
    rentalPayment: { findMany: mocks.payments, findFirst: mocks.firstPayment },
    rental: { findMany: mocks.rentals, findFirst: mocks.firstRental },
    maintenanceRecord: { findMany: mocks.maintenance },
    washRecord: { findMany: mocks.wash },
    fuelStationVisit: { findMany: mocks.visits },
  },
}));
import { getStatisticsWorkspace } from './queries';
const user = {
  id: 'user',
  name: 'User',
  role: 'MEMBER',
  email: 'user@example.test',
  canAccessAdmin: false,
};
const vehicle = {
  id: 'v1',
  companyId: 'company-a',
  make: 'Kia',
  model: 'Rio',
  registrationNumber: 'А001АА',
  images: [],
};
describe('statistics authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue({ user, scope: 'COMPANY', companyIds: ['company-a'] });
    mocks.vehicles.mockResolvedValue([vehicle]);
    mocks.firstRental.mockResolvedValue({ startsAt: new Date('2020-01-01T12:00:00+03:00') });
    mocks.firstPayment.mockResolvedValue({ recordedAt: new Date('2021-01-01T12:00:00+03:00') });
    for (const query of [
      mocks.payments,
      mocks.rentals,
      mocks.maintenance,
      mocks.wash,
      mocks.visits,
    ])
      query.mockResolvedValue([]);
  });
  it('does not read any data without rental access', async () => {
    mocks.access.mockResolvedValue(null);
    expect(await getStatisticsWorkspace({})).toMatchObject({ accessDenied: true });
    expect(mocks.vehicles).not.toHaveBeenCalled();
    expect(mocks.payments).not.toHaveBeenCalled();
  });
  it('scopes vehicles, receipts and history to an authorized company', async () => {
    await getStatisticsWorkspace({ vehicleId: 'v1', period: '999999' });
    expect(mocks.vehicles).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: { in: ['company-a'] } }),
        take: 501,
      }),
    );
    expect(mocks.payments).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-a',
          rental: { vehicleId: 'v1', companyId: 'company-a' },
        }),
        take: 2001,
      }),
    );
    for (const query of [mocks.maintenance, mocks.wash, mocks.visits])
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ vehicleId: 'v1', vehicle: { companyId: 'company-a' } }),
          take: 2001,
        }),
      );
  });
  it('never reads financial or location history for an unrecognized vehicle', async () => {
    expect(await getStatisticsWorkspace({ vehicleId: 'foreign-id' })).toMatchObject({
      selected: null,
    });
    expect(mocks.payments).not.toHaveBeenCalled();
    expect(mocks.visits).not.toHaveBeenCalled();
  });
  it('labels bounded history instead of presenting partial totals as complete', async () => {
    mocks.payments.mockResolvedValue(
      Array.from({ length: 2001 }, () => ({
        kind: 'RENT',
        status: 'CONFIRMED',
        amountMinor: 100n,
        currency: 'RUB',
        recordedAt: new Date(),
      })),
    );
    expect(await getStatisticsWorkspace({})).toMatchObject({ partial: true });
  });
  it('starts all-time history at the earliest real scoped rental or receipt', async () => {
    const result = await getStatisticsWorkspace({ vehicleId: 'v1', period: 'all' });
    expect(result.window.from).toEqual(new Date('2020-01-01T00:00:00+03:00'));
    expect(mocks.firstRental).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-a', vehicleId: 'v1' }),
      }),
    );
  });
  it('selects late-completed rentals by actual overlap even when contract and return are outside the window', async () => {
    const result = await getStatisticsWorkspace({ vehicleId: 'v1', period: '7' });
    expect(mocks.rentals).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-a',
          vehicleId: 'v1',
          OR: expect.arrayContaining([
            {
              AND: [
                {
                  OR: [
                    { activatedAt: { lt: result.window.to } },
                    { activatedAt: null, startsAt: { lt: result.window.to } },
                  ],
                },
                {
                  OR: [
                    { completedAt: { gt: result.window.from } },
                    { completedAt: null, endsAt: { gt: result.window.from } },
                  ],
                },
              ],
            },
          ]),
        }),
      }),
    );
  });
});
