import { describe, expect, it } from 'vitest';
import { deadlineGroup, deadlineDay, deadlineWeek } from './deadline-queue';

describe('deadline queue', () => {
  const now = '2026-10-19T10:00:00Z';
  const fine = { status: 'UNPAID', discountExpiresAt: '2026-10-19T20:59:59Z', currentAmountMinor: '10000', originalAmountMinor: '20000' };
  it('uses Moscow dates and distinguishes today from this week', () => {
    expect(deadlineGroup(fine, now)).toBe(0);
    expect(deadlineGroup({ ...fine, discountExpiresAt: '2026-10-19T21:00:00Z' }, now)).toBe(1);
    expect(deadlineDay('2026-10-19T21:00:00Z')).toBe('2026-10-20');
  });
  it('never marks a paid fine urgent or treats expired discount as active', () => {
    expect(deadlineGroup({ ...fine, status: 'PAID' }, now)).toBe(2);
    expect(deadlineGroup({ ...fine, status: 'ARCHIVED' }, now)).toBe(2);
    expect(deadlineGroup({ ...fine, discountExpiresAt: '2026-10-18T10:00:00Z' }, now)).toBe(2);
    expect(deadlineGroup({ ...fine, status: 'OVERDUE' }, now)).toBe(0);
  });
  it('builds seven days with exact totals excluding paid fines', () => {
    const days = deadlineWeek(
      [fine, { ...fine, status: 'PAID' }, { ...fine, status: 'ARCHIVED' }],
      now,
    );
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ day: '2026-10-19', count: 1, amountMinor: '10000' });
    expect(days[6].day).toBe('2026-10-25');
  });
});
