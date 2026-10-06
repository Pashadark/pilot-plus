import { describe, expect, it } from 'vitest';

import {
  isCompleteWeeklyInspection,
  moscowWeekRange,
  nextFridayMorning,
} from './weekly-inspection';

describe('lease-to-own weekly inspection', () => {
  it('uses a Moscow Monday-to-Monday week', () => {
    const range = moscowWeekRange(new Date('2026-09-13T12:00:00.000Z'));
    expect(range.weekKey).toBe('2026-09-07');
    expect(range.start.toISOString()).toBe('2026-09-06T21:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-09-13T21:00:00.000Z');
  });

  it('requires dashboard, four body sides and video', () => {
    expect(
      isCompleteWeeklyInspection([
        'DASHBOARD_PHOTO',
        'BODY_PHOTO_FRONT',
        'BODY_PHOTO_REAR',
        'BODY_PHOTO_LEFT',
        'BODY_PHOTO_RIGHT',
        'INSPECTION_VIDEO',
      ]),
    ).toBe(true);
    expect(isCompleteWeeklyInspection(['DASHBOARD_PHOTO', 'INSPECTION_VIDEO'])).toBe(false);
  });

  it('returns the next Friday at 08:00 Moscow', () => {
    expect(nextFridayMorning(new Date('2026-09-13T12:00:00.000Z')).toISOString()).toBe(
      '2026-09-18T05:00:00.000Z',
    );
  });
});
