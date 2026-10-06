import { describe, expect, it } from 'vitest';
import { serviceMeter, meterColor, validServiceInterval } from './service-meter';

describe('service meter', () => {
  it('shows remaining interval rather than lifetime mileage', () => {
    expect(serviceMeter(95000, 90000, 100000)).toEqual({ remaining: 5000, percent: 50 });
  });
  it('keeps overdue distance and clamps bar', () => {
    expect(serviceMeter(101000, 90000, 100000)).toEqual({ remaining: -1000, percent: 0 });
  });
  it('does not invent unknown mileage or invalid intervals', () => {
    expect(serviceMeter(null, 0, 10000)).toBeNull();
    expect(serviceMeter(5000, 10000, 10000)).toBeNull();
    expect(serviceMeter(5000, 6000, 10000)).toBeNull();
    expect(validServiceInterval('', '10000')).toBe(false);
    expect(validServiceInterval('0', '10000')).toBe(true);
  });
  it('uses continuous color interpolation', () => {
    expect(meterColor(0)).not.toEqual(meterColor(100));
    expect(meterColor(49)).not.toEqual(meterColor(50));
    expect(meterColor(-1)).toEqual(meterColor(0));
  });
});
