import { describe, expect, it } from 'vitest';

import { freshMigrationDatabaseUrl } from './fresh-migration-verification';

describe('fresh migration verification guard', () => {
  it('принимает только явно подтверждённую отдельную PostgreSQL БД', () => {
    expect(
      freshMigrationDatabaseUrl({
        DATABASE_URL: 'postgresql://localhost/pilot',
        FRESH_MIGRATION_DATABASE_URL: 'postgresql://localhost/pilot_fresh',
        FRESH_MIGRATION_CONFIRM: 'DISPOSABLE',
      }),
    ).toBe('postgresql://localhost/pilot_fresh');
  });

  it.each([
    [{}, 'FRESH_MIGRATION_DATABASE_URL'],
    [
      { FRESH_MIGRATION_DATABASE_URL: 'postgresql://localhost/pilot_fresh' },
      'FRESH_MIGRATION_CONFIRM',
    ],
    [
      {
        DATABASE_URL: 'postgresql://localhost/pilot',
        FRESH_MIGRATION_DATABASE_URL: 'postgresql://localhost/pilot',
        FRESH_MIGRATION_CONFIRM: 'DISPOSABLE',
      },
      'не должна совпадать',
    ],
    [
      {
        FRESH_MIGRATION_DATABASE_URL: 'mysql://localhost/pilot_fresh',
        FRESH_MIGRATION_CONFIRM: 'DISPOSABLE',
      },
      'PostgreSQL',
    ],
  ])('отклоняет небезопасную конфигурацию %#', (environment, message) => {
    expect(() => freshMigrationDatabaseUrl(environment)).toThrow(message);
  });
});
