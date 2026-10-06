export type FuelLevelReading = {
  value: unknown | null | undefined;
  recordedAt: Date | null | undefined;
};

function toFiniteNumber(value: unknown | null | undefined) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function latestFuelLevelPercent(...readings: FuelLevelReading[]) {
  const latest = readings
    .map((reading) => ({
      value: toFiniteNumber(reading.value),
      recordedAt: reading.recordedAt,
    }))
    .filter(
      (reading): reading is { value: number; recordedAt: Date } =>
        reading.value !== null && reading.recordedAt instanceof Date,
    )
    .toSorted((left, right) => right.recordedAt.getTime() - left.recordedAt.getTime())[0];

  return latest?.value ?? null;
}
