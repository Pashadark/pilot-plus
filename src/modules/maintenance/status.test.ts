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

  it('проводит ремонт от обнаруженного повреждения до завершения', () => {
    expect(canTransitionMaintenance('DAMAGE_REPORTED', 'WAITING_REPAIR')).toBe(true);
    expect(canTransitionMaintenance('DAMAGE_REPORTED', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionMaintenance('WAITING_REPAIR', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionMaintenance('IN_PROGRESS', 'COMPLETED')).toBe(true);
    expect(canTransitionMaintenance('COMPLETED', 'IN_PROGRESS')).toBe(false);
  });
});
