export function freshMigrationDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const fresh = environment.FRESH_MIGRATION_DATABASE_URL?.trim();
  if (!fresh) throw new Error('Не задан FRESH_MIGRATION_DATABASE_URL для одноразовой БД.');
  if (environment.FRESH_MIGRATION_CONFIRM !== 'DISPOSABLE') {
    throw new Error('Для одноразовой БД задайте FRESH_MIGRATION_CONFIRM=DISPOSABLE.');
  }
  if (fresh === environment.DATABASE_URL?.trim()) {
    throw new Error('Одноразовая БД не должна совпадать с основной DATABASE_URL.');
  }
  const parsed = new URL(fresh);
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('FRESH_MIGRATION_DATABASE_URL должен указывать на PostgreSQL.');
  }
  return fresh;
}
