export const LOW_FUEL_THRESHOLD_PERCENT = 25;
export const FUEL_RECOVERY_PERCENT = 30;
export const FUEL_READING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type FuelLevelTone = 'danger' | 'caution' | 'warning' | 'success';

export function normalizeFuelLevel(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(100, value)));
}

export function fuelLevelTone(value: number): FuelLevelTone {
  const safe = normalizeFuelLevel(value);
  if (safe <= LOW_FUEL_THRESHOLD_PERCENT) return 'danger';
  if (safe <= 40) return 'caution';
  if (safe <= 70) return 'warning';
  return 'success';
}

export function isLowFuelLevel(value: number | null | undefined) {
  return (
    value !== null &&
    value !== undefined &&
    Number.isFinite(value) &&
    value >= 0 &&
    value < LOW_FUEL_THRESHOLD_PERCENT
  );
}

export type FuelReading = { fuelLevelPercent: number | null; observedAt: Date };
export function selectFreshFuelReading<T extends FuelReading>(
  readings: readonly T[],
  now: Date,
): T | null {
  return (
    readings
      .filter(
        (reading) =>
          reading.fuelLevelPercent !== null &&
          Number.isFinite(reading.fuelLevelPercent) &&
          reading.fuelLevelPercent >= 0 &&
          reading.fuelLevelPercent <= 100 &&
          now.getTime() >= reading.observedAt.getTime() &&
          now.getTime() - reading.observedAt.getTime() <= FUEL_READING_MAX_AGE_MS,
      )
      .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime())[0] ?? null
  );
}
