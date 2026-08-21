import { describe, expect, it } from 'vitest';

import { deriveEvidenceStatus } from './evidence-status';

describe('rental operation evidence status', () => {
  it.each([
    [true, true, 'COMPLETE'],
    [false, true, 'VIDEO_MISSING'],
    [true, false, 'DASHBOARD_PHOTO_MISSING'],
    [false, false, 'MISSING'],
  ] as const)('derives status from CLEAN media', (hasVideo, hasDashboardPhoto, expected) => {
    expect(deriveEvidenceStatus({ hasVideo, hasDashboardPhoto })).toBe(expected);
  });
});
