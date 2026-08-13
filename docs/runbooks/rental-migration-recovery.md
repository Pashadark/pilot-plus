# Rental migration recovery

Use this runbook only for the rental rolling migrations in a controlled maintenance window. Do
not run it against a shared database from an automated task. Preserve the failed migration name
and the exact index name from the failed deployment output.

## Failed concurrent index migration

1. Stop writers that could introduce another duplicate while recovery is in progress. Do not edit
   data automatically.
2. Inspect only the named index. Replace `<index_name>` with the exact quoted index name:

   ```sql
   SELECT c.relname AS index_name, i.indisvalid, i.indisready
   FROM pg_index AS i
   JOIN pg_class AS c ON c.oid = i.indexrelid
   WHERE c.relname = '<index_name>';
   ```

3. If that query shows the target index is invalid or partial, remove only that index:

   ```sql
   DROP INDEX CONCURRENTLY IF EXISTS "<index_name>";
   ```

   Do not drop a valid index, do not use a wildcard, and do not drop any other index.

4. Mark only the failed migration as rolled back, then rerun the canonical deployment command:

   ```powershell
   npx prisma migrate resolve --rolled-back <migration_name>
   npx prisma migrate deploy
   ```

5. Verify both migration history and the rebuilt index:

   ```sql
   SELECT migration_name, finished_at, rolled_back_at
   FROM "_prisma_migrations"
   WHERE migration_name = '<migration_name>';

   SELECT c.relname AS index_name, i.indisvalid, i.indisready
   FROM pg_index AS i
   JOIN pg_class AS c ON c.oid = i.indexrelid
   WHERE c.relname = '<index_name>';
   ```

`finished_at` must be set with no `rolled_back_at`, and the index must be both valid and ready.
For a duplicate-key failure, resolve the identified application data explicitly, then repeat the
same targeted recovery. Never run seed data or a shared-database reset as part of this procedure.
