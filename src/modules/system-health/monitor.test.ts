import { describe, expect, it } from 'vitest';
import { canViewMonitor, resourceUsage } from './monitor-model';

describe('system monitor', () => {
  it('allows only SUPER_ADMIN', () => {
    expect(canViewMonitor({ role: 'SUPER_ADMIN' })).toBe(true);
    expect(canViewMonitor({ role: 'MEMBER' })).toBe(false);
    expect(canViewMonitor(null)).toBe(false);
  });
  it('calculates used resources without inventing missing metrics', () => {
    expect(resourceUsage(100, 20)).toEqual({ total: 100, available: 20, used: 80, percent: 80 });
    expect(resourceUsage(0, 0)).toBeNull();
    expect(resourceUsage(100, 120)).toBeNull();
    expect(resourceUsage(NaN, 10)).toBeNull();
  });
});
