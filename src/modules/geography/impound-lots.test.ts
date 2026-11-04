import { describe, expect, it } from 'vitest';

import {
  detectConfirmedImpoundStay,
  detectImpoundEntry,
  findImpoundLot,
  IMPOUND_LOTS,
} from './impound-lots';

describe('impound lot geofences', () => {
  it('contains every Moscow lot from the official current list', () => {
    expect(IMPOUND_LOTS.filter((lot) => lot.city === 'Москва')).toHaveLength(21);
  });

  it('contains the official Saint Petersburg locations', () => {
    expect(
      IMPOUND_LOTS.filter((lot) => lot.city === 'Санкт-Петербург').length,
    ).toBeGreaterThanOrEqual(14);
  });

  it('finds a point inside the Podolskikh Kursantov lot', () => {
    expect(findImpoundLot(55.607911, 37.624418)?.id).toBe('moscow-podolskikh-kursantov-7a');
  });

  it('does not match a distant point', () => {
    expect(findImpoundLot(55.7558, 37.6176)).toBeNull();
  });

  it('detects only an outside-to-inside transition', () => {
    const outside = { latitude: 55.61, longitude: 37.63 };
    const inside = { latitude: 55.607911, longitude: 37.624418 };

    expect(detectImpoundEntry(outside, inside)?.id).toBe('moscow-podolskikh-kursantov-7a');
    expect(detectImpoundEntry(inside, inside)).toBeNull();
    expect(detectImpoundEntry(inside, outside)).toBeNull();
    expect(detectImpoundEntry(null, inside)?.id).toBe('moscow-podolskikh-kursantov-7a');
  });

  it('не принимает быстрый проезд по Косинскому шоссе за нахождение на штрафстоянке', () => {
    expect(
      detectConfirmedImpoundStay([
        {
          latitude: 55.709053,
          longitude: 37.876682,
          speedKph: 41,
          recordedAt: new Date('2026-10-27T12:56:34Z'),
        },
        {
          latitude: 55.708477,
          longitude: 37.881697,
          speedKph: 62,
          recordedAt: new Date('2026-10-27T12:56:57Z'),
        },
        {
          latitude: 55.707528,
          longitude: 37.892602,
          speedKph: 77,
          recordedAt: new Date('2026-10-27T12:57:42Z'),
        },
      ]),
    ).toBeNull();
  });

  it('не подтверждает штрафстоянку после короткой остановки внутри зоны', () => {
    const enteredAt = new Date('2026-10-27T12:56:00Z');

    expect(
      detectConfirmedImpoundStay([
        {
          latitude: 55.708048,
          longitude: 37.880954,
          speedKph: 0,
          recordedAt: enteredAt,
        },
        {
          latitude: 55.70806,
          longitude: 37.88096,
          speedKph: 0,
          recordedAt: new Date('2026-10-27T12:58:30Z'),
        },
      ]),
    ).toBeNull();
  });

  it('подтверждает штрафстоянку после тридцати минут без движения внутри зоны', () => {
    const enteredAt = new Date('2026-10-27T12:00:00Z');

    expect(
      detectConfirmedImpoundStay([
        {
          latitude: 55.708048,
          longitude: 37.880954,
          speedKph: 0,
          recordedAt: enteredAt,
        },
        {
          latitude: 55.70805,
          longitude: 37.880956,
          speedKph: 1,
          recordedAt: new Date('2026-10-27T12:15:00Z'),
        },
        {
          latitude: 55.708047,
          longitude: 37.880952,
          speedKph: 0,
          recordedAt: new Date('2026-10-27T12:30:30Z'),
        },
      ]),
    ).toMatchObject({
      lot: { id: 'moscow-kaskadnaya-28' },
      enteredAt,
    });
  });

  it('не подтверждает штрафстоянку, если машина перемещалась внутри зоны', () => {
    expect(
      detectConfirmedImpoundStay([
        {
          latitude: 55.708048,
          longitude: 37.880954,
          speedKph: 0,
          recordedAt: new Date('2026-10-27T12:00:00Z'),
        },
        {
          latitude: 55.708048,
          longitude: 37.8824,
          speedKph: 2,
          recordedAt: new Date('2026-10-27T12:15:00Z'),
        },
        {
          latitude: 55.708047,
          longitude: 37.880952,
          speedKph: 0,
          recordedAt: new Date('2026-10-27T12:31:00Z'),
        },
      ]),
    ).toBeNull();
  });
});
