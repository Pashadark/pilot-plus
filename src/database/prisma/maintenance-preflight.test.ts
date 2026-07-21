import { describe, expect, it } from 'vitest';

import { getMaintenanceMigrationPreflightError } from './maintenance-preflight';

describe('maintenance migration preflight', () => {
  it('останавливает неизвестные статусы с количеством строк', () => {
    expect(
      getMaintenanceMigrationPreflightError([
        { status: 'WAITING_PARTS', rowCount: 2, nonDerivableOverdueCount: 0 },
      ]),
    ).toContain('WAITING_PARTS (2)');
  });

  it('останавливает OVERDUE без доказуемой прошедшей плановой даты', () => {
    expect(
      getMaintenanceMigrationPreflightError([
        { status: 'OVERDUE', rowCount: 3, nonDerivableOverdueCount: 1 },
      ]),
    ).toContain('OVERDUE (1)');
  });

  it('разрешает только известные статусы и доказуемый OVERDUE', () => {
    expect(
      getMaintenanceMigrationPreflightError([
        { status: 'PLANNED', rowCount: 2, nonDerivableOverdueCount: 0 },
        { status: 'OVERDUE', rowCount: 3, nonDerivableOverdueCount: 0 },
      ]),
    ).toBeNull();
  });
});
