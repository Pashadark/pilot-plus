import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ACCELERATION_DETECTOR_SETTINGS,
  detectHarshAcceleration,
  type AccelerationSample,
} from './harsh-acceleration';

function sample(
  id: string,
  second: number,
  speedKph: number,
  latitude = 55.75,
  longitude = 37.61,
): AccelerationSample {
  return {
    id,
    recordedAt: new Date(Date.UTC(2026, 9, 25, 10, 0, second)),
    latitude,
    longitude,
    speedKph,
  };
}

describe('detectHarshAcceleration', () => {
  it('не создаёт событие при обычном разгоне', () => {
    const samples = [sample('p0', 0, 0), sample('p1', 1, 7.2), sample('p2', 2, 14.4), sample('p3', 3, 21.6)];

    expect(detectHarshAcceleration(samples, DEFAULT_ACCELERATION_DETECTOR_SETTINGS)).toEqual([]);
  });

  it('подтверждает резкий разгон только после трёх секунд', () => {
    const unconfirmed = [sample('p0', 0, 0), sample('p1', 1, 12.6), sample('p2', 2, 25.2)];
    const confirmed = [...unconfirmed, sample('p3', 3, 37.8)];

    expect(detectHarshAcceleration(unconfirmed, DEFAULT_ACCELERATION_DETECTOR_SETTINGS)).toEqual([]);
    expect(detectHarshAcceleration(confirmed, DEFAULT_ACCELERATION_DETECTOR_SETTINGS)).toEqual([
      expect.objectContaining({
        severity: 'WARNING',
        startPointId: 'p0',
        endPointId: 'p3',
        durationMs: 3_000,
        pointIds: ['p0', 'p1', 'p2', 'p3'],
      }),
    ]);
  });

  it('помечает критический разгон по максимальному ускорению', () => {
    const samples = [sample('p0', 0, 0), sample('p1', 1, 16.2), sample('p2', 2, 32.4), sample('p3', 3, 48.6)];

    expect(detectHarshAcceleration(samples, DEFAULT_ACCELERATION_DETECTOR_SETTINGS)).toEqual([
      expect.objectContaining({
        severity: 'CRITICAL',
        maxAccelerationMps2: 4.5,
      }),
    ]);
  });

  it('сортирует точки, убирает дубли и сохраняет событие идемпотентным', () => {
    const samples = [
      sample('p3', 3, 37.8),
      sample('p1', 1, 12.6),
      sample('duplicate', 1, 12.6),
      sample('p0', 0, 0),
      sample('p2', 2, 25.2),
    ];

    const events = detectHarshAcceleration(samples, DEFAULT_ACCELERATION_DETECTOR_SETTINGS);

    expect(events).toHaveLength(1);
    expect(events[0]?.pointIds).toHaveLength(4);
    expect(events[0]?.startedAt.toISOString()).toBe('2026-10-25T10:00:00.000Z');
  });

  it('отбрасывает невалидные координаты, длинные разрывы и невозможные GPS-прыжки', () => {
    const invalidCoordinates = [
      sample('p0', 0, 0),
      sample('p1', 1, 20, 120, 37.61),
      sample('p2', 2, 40),
      sample('p3', 3, 60),
    ];
    const longGap = [sample('p0', 0, 0), sample('p1', 1, 16.2), sample('p2', 20, 32.4), sample('p3', 21, 48.6)];
    const gpsJump = [
      sample('p0', 0, 0),
      sample('p1', 1, 16.2, 59.93, 30.31),
      sample('p2', 2, 32.4, 55.75, 37.61),
      sample('p3', 3, 48.6, 55.75, 37.61),
    ];

    expect(detectHarshAcceleration(invalidCoordinates, DEFAULT_ACCELERATION_DETECTOR_SETTINGS)).toEqual([]);
    expect(detectHarshAcceleration(longGap, DEFAULT_ACCELERATION_DETECTOR_SETTINGS)).toEqual([]);
    expect(detectHarshAcceleration(gpsJump, DEFAULT_ACCELERATION_DETECTOR_SETTINGS)).toEqual([]);
  });

  it('объединяет подтверждённые интервалы в пределах трёх секунд', () => {
    const samples = [
      sample('p0', 0, 0),
      sample('p1', 1, 12.6),
      sample('p2', 2, 25.2),
      sample('p3', 3, 37.8),
      sample('p4', 4, 37.8),
      sample('p5', 5, 37.8),
      sample('p6', 6, 50.4),
      sample('p7', 7, 63),
      sample('p8', 8, 75.6),
      sample('p9', 9, 88.2),
    ];

    const events = detectHarshAcceleration(samples, DEFAULT_ACCELERATION_DETECTOR_SETTINGS);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        startPointId: 'p0',
        endPointId: 'p9',
        durationMs: 9_000,
      }),
    );
  });
});
