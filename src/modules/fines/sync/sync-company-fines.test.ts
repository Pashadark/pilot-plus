import { describe, expect, it, vi } from 'vitest';

import { syncCompanyFinesWithDependencies } from './sync-company-fines';

describe('company fine sync', () => {
  it('paginates, links a vehicle, and idempotently upserts fines', async () => {
    const upsertLink = vi.fn().mockResolvedValue({ vehicleId: 'vehicle-a' });
    const upsertFine = vi.fn().mockResolvedValue({ created: true });
    const dependencies = {
      listCars: vi.fn().mockResolvedValueOnce({ current: 1, last: 1, items: [{ id: 7 }] }),
      listFines: vi.fn().mockResolvedValueOnce({
        current: 1,
        last: 1,
        items: [{ id: 91, car: { id: 7 } }],
      }),
      normalizeCar: vi.fn().mockReturnValue({ externalId: '7' }),
      normalizeFine: vi.fn().mockReturnValue({
        externalId: '91',
        providerVehicleId: '7',
        offenseAt: new Date('2026-08-16T09:30:00.000Z'),
      }),
      upsertLink,
      upsertFine,
    };

    await expect(syncCompanyFinesWithDependencies('company-a', dependencies)).resolves.toEqual({
      ok: true,
      received: 1,
      created: 1,
      updated: 0,
      unmatched: 0,
    });
    expect(upsertLink).toHaveBeenCalledWith('company-a', { externalId: '7' });
    expect(upsertFine).toHaveBeenCalledWith(
      'company-a',
      expect.objectContaining({ externalId: '91' }),
      'vehicle-a',
    );
  });

  it('caps malformed provider pagination at 200 pages', async () => {
    const dependencies = {
      listCars: vi.fn().mockResolvedValue({ current: 1, last: 999, items: [{ id: 7 }] }),
      listFines: vi.fn().mockResolvedValue({ current: 1, last: 1, items: [] }),
      normalizeCar: vi.fn().mockReturnValue({ externalId: '7' }),
      normalizeFine: vi.fn(),
      upsertLink: vi.fn().mockResolvedValue({ vehicleId: null }),
      upsertFine: vi.fn(),
    };

    await expect(syncCompanyFinesWithDependencies('company-a', dependencies)).rejects.toThrow(
      'лимит страниц',
    );
    expect(dependencies.listCars).toHaveBeenCalledTimes(200);
  });
});
