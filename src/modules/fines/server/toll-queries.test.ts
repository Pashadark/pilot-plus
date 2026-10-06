import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  integration: vi.fn(),
  vehicles: vi.fn(),
  rentals: vi.fn(),
  api: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    fineIntegration: { findMany: mocks.integration },
    vehicle: { findMany: mocks.vehicles },
    rental: { findMany: mocks.rentals },
  },
}));
vi.mock('@/services/security/field-encryption', () => ({ decryptField: () => 'test-secret' }));
vi.mock('../integrations/driver-helper/client', () => ({
  DriverHelperClient: class {
    listTollDebts = mocks.api;
  },
}));
import { loadTollDebts } from './toll-queries';
const trip = {
  id: 1,
  road: 'msd',
  place: 'МСД',
  amount: 100,
  travelDate: '2026-09-22 12:00:00',
  carId: 1,
  carRegnum: 'А123АА777',
  carTitle: 'Polo',
};
describe('server road-debt loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLIENT_DATA_ENCRYPTION_KEY = 'test';
    mocks.integration.mockResolvedValue([{ companyId: 'c1', tokenEncrypted: 'x' }]);
    mocks.vehicles.mockResolvedValue([]);
    mocks.rentals.mockResolvedValue([]);
    mocks.api.mockResolvedValue({ current: 1, last: 1, items: [trip] });
  });
  it('limits provider keys and vehicles to authorized company ids', async () => {
    const r = await loadTollDebts(['c1']);
    expect(r.items).toHaveLength(1);
    expect(mocks.integration).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: { in: ['c1'] }, enabled: true } }),
    );
    expect(mocks.vehicles).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1' } }),
    );
  });
  it('does not read providers for empty access scope', async () => {
    expect(await loadTollDebts([])).toEqual({ items: [], unavailable: false });
    expect(mocks.integration).not.toHaveBeenCalled();
  });
  it('reports upstream failure instead of silently showing zero', async () => {
    mocks.api.mockRejectedValue(new Error('private provider error'));
    expect(await loadTollDebts(['c1'])).toEqual({ items: [], unavailable: true });
  });
  it('deduplicates paginated records', async () => {
    mocks.api
      .mockResolvedValueOnce({ current: 1, last: 2, items: [trip] })
      .mockResolvedValueOnce({ current: 2, last: 2, items: [trip] });
    expect((await loadTollDebts(['c1'])).items).toHaveLength(1);
  });
});
