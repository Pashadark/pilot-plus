import { describe, expect, it } from 'vitest';

import { calculateMaintenanceSummary, getEffectiveMaintenanceStatus } from './effective-status';

describe('effective maintenance status', () => {
  const now = new Date('2026-07-22T09:00:00.000Z');

  it('maps a stored PLANNED record in the past to OVERDUE', () => {
    expect(getEffectiveMaintenanceStatus('PLANNED', '2026-07-22T08:59:59.000Z', now)).toBe(
      'OVERDUE',
    );
  });

  it('keeps future and terminal statuses unchanged', () => {
    expect(getEffectiveMaintenanceStatus('PLANNED', '2026-07-22T09:00:00.000Z', now)).toBe(
      'PLANNED',
    );
    expect(getEffectiveMaintenanceStatus('COMPLETED', '2026-07-01T00:00:00.000Z', now)).toBe(
      'COMPLETED',
    );
  });

  it('calculates the four dashboard KPIs in Pilot+ business time', () => {
    const records = [
      { status: 'PLANNED' as const, scheduledAt: '2026-07-23T09:00:00.000Z', completedAt: null },
      { status: 'PLANNED' as const, scheduledAt: '2026-08-15T09:00:00.000Z', completedAt: null },
      { status: 'OVERDUE' as const, scheduledAt: '2026-07-20T09:00:00.000Z', completedAt: null },
      {
        status: 'COMPLETED' as const,
        scheduledAt: '2026-07-01T09:00:00.000Z',
        completedAt: '2026-07-01T21:30:00.000Z',
      },
      {
        status: 'COMPLETED' as const,
        scheduledAt: '2026-06-01T09:00:00.000Z',
        completedAt: '2026-06-30T20:30:00.000Z',
      },
    ];

    expect(calculateMaintenanceSummary(records, now)).toEqual({
      planned: 2,
      dueSoon: 1,
      overdue: 1,
      completedThisMonth: 1,
    });
  });
});
