export const LOW_FUEL_THRESHOLD_PERCENT = 20;

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
    value !== null && value !== undefined && normalizeFuelLevel(value) <= LOW_FUEL_THRESHOLD_PERCENT
  );
}
