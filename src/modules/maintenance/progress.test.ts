import { describe, expect, it } from 'vitest';

import { calculateMaintenanceOdometerProgress } from './progress';

describe('maintenance odometer progress', () => {
  it('calculates remaining distance and clamped progress from the stored start snapshot', () => {
    expect(
      calculateMaintenanceOdometerProgress({
        startOdometerKm: 10_000,
        currentOdometerKm: 12_000,
        targetOdometerKm: 15_000,
      }),
    ).toEqual({ remainingKm: 3_000, progressPercent: 40 });
  });

  it('does not invent progress when the required odometer data is missing', () => {
    expect(
      calculateMaintenanceOdometerProgress({
        startOdometerKm: null,
        currentOdometerKm: 12_000,
        targetOdometerKm: 15_000,
      }),
    ).toEqual({ remainingKm: 3_000, progressPercent: null });
  });
});
