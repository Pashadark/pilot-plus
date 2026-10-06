import { describe, expect, it } from 'vitest';
import { groupWorkdayItems } from './workday-groups';
import type { DashboardWorkItemDto } from './overview-types';

const item = (id: string, scheduledAt: string, overrides = {}): DashboardWorkItemDto => ({
  id,
  scheduledAt,
  kind: 'MANUAL_TASK',
  title: id,
  tone: 'info',
  href: '/',
  vehicleLabel: '',
  clientLabel: null,
  phone: null,
  contractNumber: null,
  address: null,
  amountMinor: null,
  overdue: false,
  ...overrides,
});
describe('workday grouping', () => {
  it('uses Moscow days, keeps explicit overdue first and unscheduled items secondary', () => {
    const result = groupWorkdayItems(
      [
        item('today', '2026-09-21T21:00:00Z'),
        item('tomorrow', '2026-09-22T21:00:00Z'),
        item('overdue', '2026-09-22T00:00:00Z', { overdue: true }),
        item('undated', '2026-09-01T00:00:00Z', { unscheduled: true }),
        item('past-event', '2026-09-20T00:00:00Z'),
      ],
      '2026-09-22T09:00:00Z',
    );
    expect(result.overdue.map((x) => x.id)).toEqual(['overdue']);
    expect(result.today.map((x) => x.id)).toEqual(['today']);
    expect(result.tomorrow.map((x) => x.id)).toEqual(['tomorrow']);
    expect(result.other.map((x) => x.id)).toEqual(['past-event', 'undated']);
  });
  it('caps only secondary items at 20, retaining all urgent items', () => {
    const result = groupWorkdayItems(
      [
        ...Array.from({ length: 23 }, (_, i) => item(`other-${i}`, '2026-09-25T00:00:00Z')),
        ...Array.from({ length: 25 }, (_, i) =>
          item(`urgent-${i}`, '2026-09-21T00:00:00Z', { overdue: true }),
        ),
      ],
      '2026-09-22T09:00:00Z',
    );
    expect(result.other).toHaveLength(20);
    expect(result.otherTotal).toBe(23);
    expect(result.overdue).toHaveLength(25);
  });
});
