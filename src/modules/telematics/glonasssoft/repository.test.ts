import { describe, expect, it, vi } from 'vitest';

import type { FleetDatabase } from './actions';
import { loadExistingFleetRows } from './repository';

describe('подсчёт истории автомобиля перед очисткой', () => {
  it('считает все ссылки и не считает саму запись автомобиля', async () => {
    const database = {
      vehicle: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'vehicle-1',
            registrationNumberNormalized: 'О001ОО77',
            make: 'Demo',
            modelName: 'Car',
            isDemoImport: true,
            device: { id: 'device-1' },
            _count: { rentals: 2, fines: 1, positions: 3 },
          },
        ]),
      },
    } as unknown as FleetDatabase;

    await expect(loadExistingFleetRows(database, 'company-a')).resolves.toEqual([
      expect.objectContaining({ id: 'vehicle-1', references: 7, isDemoImport: true }),
    ]);
    expect(database.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'company-a', archivedAt: null } }),
    );
  });
});
