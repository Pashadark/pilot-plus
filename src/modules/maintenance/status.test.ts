import { describe, expect, it } from 'vitest';

import { canTransitionMaintenance } from './status';

describe('переходы статусов ТО', () => {
  it('разрешает переход из запланированного ТО в работу', () => {
    expect(canTransitionMaintenance('PLANNED', 'IN_PROGRESS')).toBe(true);
  });

  it('запрещает возобновление завершённого ТО', () => {
    expect(canTransitionMaintenance('COMPLETED', 'IN_PROGRESS')).toBe(false);
  });

  it('разрешает только предусмотренные переходы для просроченного ТО', () => {
    expect(canTransitionMaintenance('OVERDUE', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionMaintenance('OVERDUE', 'CANCELLED')).toBe(true);
    expect(canTransitionMaintenance('OVERDUE', 'COMPLETED')).toBe(false);
  });
});
