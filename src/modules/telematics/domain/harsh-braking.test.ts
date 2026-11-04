import { describe, expect, it } from 'vitest';

import { DEFAULT_BRAKING_DETECTOR_SETTINGS, detectHarshBraking } from './harsh-braking';

function sample(id: string, second: number, speedKph: number, latitude = 55.75) {
  return {
    id,
    recordedAt: new Date(Date.UTC(2026, 9, 27, 10, 0, second)),
    latitude,
    longitude: 37.61,
    speedKph,
  };
}

describe('detectHarshBraking', () => {
  it('находит подтверждённое резкое торможение и сохраняет отрицательное ускорение', () => {
    const events = detectHarshBraking(
      [sample('p0', 0, 90), sample('p1', 1, 75), sample('p2', 2, 60), sample('p3', 3, 45)],
      DEFAULT_BRAKING_DETECTOR_SETTINGS,
    );

    expect(events).toEqual([
      expect.objectContaining({
        severity: 'CRITICAL',
        startPointId: 'p0',
        endPointId: 'p3',
        startSpeedKph: 90,
        endSpeedKph: 45,
        maxAccelerationMps2: -4.167,
        durationMs: 3_000,
        pointIds: ['p0', 'p1', 'p2', 'p3'],
      }),
    ]);
  });

  it('не считает обычное плавное замедление событием', () => {
    expect(
      detectHarshBraking(
        [sample('p0', 0, 60), sample('p1', 2, 55), sample('p2', 4, 50)],
        DEFAULT_BRAKING_DETECTOR_SETTINGS,
      ),
    ).toEqual([]);
  });

  it('разрывает событие при большом временном или географическом скачке', () => {
    expect(
      detectHarshBraking(
        [sample('p0', 0, 90), sample('p1', 1, 75), sample('p2', 20, 55)],
        DEFAULT_BRAKING_DETECTOR_SETTINGS,
      ),
    ).toEqual([]);

    expect(
      detectHarshBraking(
        [sample('p0', 0, 90), sample('p1', 1, 75, 56.75), sample('p2', 2, 60)],
        DEFAULT_BRAKING_DETECTOR_SETTINGS,
      ),
    ).toEqual([]);
  });

  it('подавляет одиночный выброс скорости между близкими значениями', () => {
    expect(
      detectHarshBraking(
        [sample('p0', 0, 90), sample('p1', 1, 0), sample('p2', 2, 88)],
        DEFAULT_BRAKING_DETECTOR_SETTINGS,
      ),
    ).toEqual([]);
  });
});
