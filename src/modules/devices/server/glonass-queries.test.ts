import { expect, it, vi } from 'vitest';

import { createGlonassDeviceQueries } from './glonass-queries';

it('показывает реальные связи ГЛОНАССSoft вместо демонстрационных Pilot Connect', async () => {
  const findMany = vi.fn().mockResolvedValue([
    {
      id: 'link-1',
      externalId: '4821',
      provider: 'GLONASSSOFT',
      updatedAt: new Date('2026-09-16T05:00:00.000Z'),
      vehicle: {
        id: 'vehicle-1',
        internalNumber: 'CAR-008',
        make: 'Kia',
        modelName: 'Cerato',
        model: 'Kia Cerato',
        registrationNumber: 'С886АУ997',
        positions: [
          {
            recordedAt: new Date('2026-09-16T05:09:00.000Z'),
            speedKph: 42,
            heading: 127,
            latitude: 55.75,
            longitude: 37.61,
            address: 'Москва',
          },
        ],
      },
    },
  ]);
  const queries = createGlonassDeviceQueries(
    { telematicsVehicleLink: { findMany } },
    async () => ({ companyId: 'company-1' }),
    () => new Date('2026-09-16T05:10:00.000Z'),
  );

  const result = await queries.getPageData();

  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { companyId: 'company-1', provider: 'GLONASSSOFT' } }),
  );
  expect(result.trackers).toEqual([
    expect.objectContaining({
      externalId: '4821',
      status: 'ONLINE',
      speedKph: 42,
      vehicle: expect.objectContaining({ registrationNumber: 'С886АУ997' }),
    }),
  ]);
  expect(result.summary).toEqual({ total: 1, online: 1, stale: 0, offline: 0 });
});
