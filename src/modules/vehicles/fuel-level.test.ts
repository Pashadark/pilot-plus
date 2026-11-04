import { expect, it } from 'vitest';
import { isLowFuelLevel, selectFreshFuelReading } from './fuel-level';
it('alerts strictly below25 and rejects invalid values', () => {
  expect(isLowFuelLevel(24.9)).toBe(true);
  expect(isLowFuelLevel(25)).toBe(false);
  for (const value of [null, undefined, NaN, Infinity, -1, 101])
    expect(isLowFuelLevel(value)).toBe(false);
});
it('chooses newest trustworthy reading and rejects stale/future data', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  const position = { fuelLevelPercent: 5, observedAt: new Date('2026-10-07T12:00:00Z') };
  const operation = { fuelLevelPercent: 80, observedAt: new Date('2026-10-09T11:00:00Z') };
  expect(selectFreshFuelReading([position, operation], now)).toEqual(operation);
  expect(selectFreshFuelReading([position], now)).toBeNull();
  expect(
    selectFreshFuelReading([{ ...operation, observedAt: new Date('2026-10-10') }], now),
  ).toBeNull();
});
