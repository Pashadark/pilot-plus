import { describe, expect, it, vi } from 'vitest';

import { syncCompanyFinesWithDependencies } from './sync-company-fines';

describe('company fine sync', () => {
  it('пропускает штраф без даты и продолжает сохранять корректные штрафы', async () => {
    const upsertFine = vi.fn().mockResolvedValue({ created: true });
    const reconcileMissing = vi.fn().mockResolvedValue(undefined);
    const dependencies = {
      listCars: vi.fn().mockResolvedValue({ current: 1, last: 1, items: [] }),
      listFines: vi.fn().mockResolvedValue({ current: 1, last: 1, items: ['missing', 'valid'] }),
      listPaidFines: vi.fn().mockResolvedValue({ current: 1, last: 1, items: [] }),
      normalizeCar: vi.fn(),
      normalizeFine: vi.fn((id: string) => ({ externalId: id, providerVehicleId: null,
        offenseAt: id === 'missing' ? null as unknown as Date : new Date('2026-09-18T10:00:00Z') })),
      upsertLink: vi.fn(), upsertFine, reconcileMissing,
    };
    const result = await syncCompanyFinesWithDependencies('company-a', dependencies);
    expect(result).toMatchObject({ received: 2, created: 1, skipped: 1 });
    expect(upsertFine).toHaveBeenCalledTimes(1);
    expect(upsertFine).toHaveBeenCalledWith('company-a', expect.objectContaining({ externalId: 'valid' }), null);
    expect(reconcileMissing).not.toHaveBeenCalled();
  });
  it('paginates, links a vehicle, and idempotently upserts fines', async () => {
    const upsertLink = vi.fn().mockResolvedValue({ vehicleId: 'vehicle-a' });
    const upsertFine = vi
      .fn()
      .mockResolvedValueOnce({ created: true })
      .mockResolvedValueOnce({ created: false });
    const reconcileMissing = vi.fn().mockResolvedValue(undefined);
    const dependencies = {
      listCars: vi.fn().mockResolvedValueOnce({ current: 1, last: 1, items: [{ id: 7 }] }),
      listFines: vi.fn().mockResolvedValueOnce({
        current: 1,
        last: 1,
        items: [{ id: 91, car: { id: 7 } }],
      }),
      listPaidFines: vi.fn().mockResolvedValueOnce({
        current: 1,
        last: 1,
        items: [{ id: 'fine-paid', carId: 'car-1', offenseAt: '2026-08-15', paid: true }],
      }),
      normalizeCar: vi.fn().mockReturnValue({ externalId: '7' }),
      normalizeFine: vi.fn((fine: { id: number | string }) => ({
        externalId: String(fine.id),
        providerVehicleId: '7',
        offenseAt: new Date('2026-08-16T09:30:00.000Z'),
      })),
      upsertLink,
      upsertFine,
      reconcileMissing,
    };

    await expect(syncCompanyFinesWithDependencies('company-a', dependencies)).resolves.toEqual({
      ok: true,
      received: 2,
      created: 1,
      updated: 1,
      unmatched: 0,
    });
    expect(upsertLink).toHaveBeenCalledWith('company-a', { externalId: '7' });
    expect(upsertFine).toHaveBeenCalledWith(
      'company-a',
      expect.objectContaining({ externalId: '91' }),
      'vehicle-a',
    );
    expect(reconcileMissing).toHaveBeenCalledWith('company-a', ['91', 'fine-paid']);
  });

  it('caps malformed provider pagination at 200 pages', async () => {
    const dependencies = {
      listCars: vi.fn().mockResolvedValue({ current: 1, last: 999, items: [{ id: 7 }] }),
      listFines: vi.fn().mockResolvedValue({ current: 1, last: 1, items: [] }),
      listPaidFines: vi.fn().mockResolvedValue({ current: 1, last: 1, items: [] }),
      normalizeCar: vi.fn().mockReturnValue({ externalId: '7' }),
      normalizeFine: vi.fn(),
      upsertLink: vi.fn().mockResolvedValue({ vehicleId: null }),
      upsertFine: vi.fn(),
      reconcileMissing: vi.fn(),
    };

    await expect(syncCompanyFinesWithDependencies('company-a', dependencies)).rejects.toThrow(
      'лимит страниц',
    );
    expect(dependencies.listCars).toHaveBeenCalledTimes(200);
  });

  it('не сверяет исчезнувшие штрафы, если чтение одной из страниц оборвалось', async () => {
    const reconcileMissing = vi.fn();
    const dependencies = {
      listCars: vi.fn().mockResolvedValue({ current: 1, last: 1, items: [] }),
      listFines: vi.fn().mockResolvedValue({ current: 1, last: 1, items: [{ id: 'fine-1' }] }),
      listPaidFines: vi.fn().mockRejectedValue(new Error('provider unavailable')),
      normalizeCar: vi.fn(),
      normalizeFine: vi.fn((fine: { id: string }) => ({
        externalId: fine.id,
        providerVehicleId: null,
        offenseAt: new Date('2026-08-16T09:30:00.000Z'),
      })),
      upsertLink: vi.fn(),
      upsertFine: vi.fn(),
      reconcileMissing,
    };

    await expect(syncCompanyFinesWithDependencies('company-a', dependencies)).rejects.toThrow(
      'provider unavailable',
    );
    expect(reconcileMissing).not.toHaveBeenCalled();
  });
});
