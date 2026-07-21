import { describe, expect, it } from 'vitest';

import { calculateFleetCleanliness, CLEAN_WASH_WINDOW_DAYS } from './cleanliness';

const referenceTime = new Date('2026-07-22T12:00:00.000Z');
const vehicles = [{ id: 'vehicle-1' }, { id: 'vehicle-2' }];

describe('чистота автомобилей', () => {
  it('требует мойки, когда у автомобиля нет завершённых моек', () => {
    const result = calculateFleetCleanliness([vehicles[0]], [], referenceTime);

    expect(result.vehicles).toEqual([
      { vehicleId: 'vehicle-1', status: 'NEEDS_WASH', lastCompletedAt: null },
    ]);
    expect(result.needsWashCount).toBe(1);
  });

  it('считает автомобиль чистым в течение семи дней после завершённой мойки', () => {
    const completedAt = new Date(referenceTime);
    completedAt.setUTCDate(completedAt.getUTCDate() - CLEAN_WASH_WINDOW_DAYS);

    const result = calculateFleetCleanliness(
      [vehicles[0]],
      [{ vehicleId: 'vehicle-1', status: 'COMPLETED', completedAt: completedAt.toISOString() }],
      referenceTime,
    );

    expect(result.vehicles[0]).toEqual({
      vehicleId: 'vehicle-1',
      status: 'CLEAN',
      lastCompletedAt: completedAt.toISOString(),
    });
    expect(result.needsWashCount).toBe(0);
  });

  it('требует мойки, когда последняя завершённая мойка старше семи дней', () => {
    const completedAt = new Date(referenceTime);
    completedAt.setUTCDate(completedAt.getUTCDate() - CLEAN_WASH_WINDOW_DAYS - 1);

    const result = calculateFleetCleanliness(
      [vehicles[0]],
      [{ vehicleId: 'vehicle-1', status: 'COMPLETED', completedAt: completedAt.toISOString() }],
      referenceTime,
    );

    expect(result.vehicles[0]?.status).toBe('NEEDS_WASH');
    expect(result.needsWashCount).toBe(1);
  });

  it('использует последнюю мойку и считает каждый автомобиль только один раз', () => {
    const result = calculateFleetCleanliness(
      vehicles,
      [
        {
          vehicleId: 'vehicle-1',
          status: 'COMPLETED',
          completedAt: '2026-07-01T12:00:00.000Z',
        },
        {
          vehicleId: 'vehicle-1',
          status: 'COMPLETED',
          completedAt: '2026-07-21T12:00:00.000Z',
        },
        {
          vehicleId: 'vehicle-2',
          status: 'COMPLETED',
          completedAt: '2026-07-01T12:00:00.000Z',
        },
        { vehicleId: 'vehicle-2', status: 'CANCELLED', completedAt: null },
      ],
      referenceTime,
    );

    expect(result.vehicles).toHaveLength(2);
    expect(result.vehicles).toEqual([
      {
        vehicleId: 'vehicle-1',
        status: 'CLEAN',
        lastCompletedAt: '2026-07-21T12:00:00.000Z',
      },
      {
        vehicleId: 'vehicle-2',
        status: 'NEEDS_WASH',
        lastCompletedAt: '2026-07-01T12:00:00.000Z',
      },
    ]);
    expect(result.needsWashCount).toBe(1);
  });
});
