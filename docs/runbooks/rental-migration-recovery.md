# Rental migration recovery

Use this runbook only for a failed one-statement concurrent rental index migration and only in a
controlled maintenance window. Do not run it from an automated task against a shared database.

First identify the exact mapping from the failed Prisma migration directory to its expected
schema-qualified index. For example, `20260813090004_add_vehicle_vin_key_concurrently` maps to
`public."Vehicle_companyId_vinNormalized_key"`. Never infer an index from a similar name, and do
not act if the deployment output, migration name, and expected index definition cannot be matched.

Set the expected definition explicitly from the migration SQL before querying. Replace the three
placeholders below only after this mapping is reviewed:

```sql
-- <expected_index_definition> must exactly equal the CREATE INDEX statement's definition.
SELECT
  n.nspname AS schemaname,
  c.relname AS indexname,
  i.indisvalid,
  i.indisready,
  pg_get_indexdef(i.indexrelid) AS index_definition
FROM pg_index AS i
JOIN pg_class AS c ON c.oid = i.indexrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = '<index_name>';
```

The query must return exactly one row. Follow exactly one branch.

## A. Completed index, failed migration record

Use this branch only when the single returned row has `indisvalid = true`, `indisready = true`, and
`pg_get_indexdef` exactly matches `<expected_index_definition>` (including schema, columns,
uniqueness, and predicate where applicable). Do not rebuild the index.

```powershell
npx prisma migrate resolve --applied <migration_name>
npx prisma migrate deploy
```

Then rerun the query above and verify Prisma history:

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name = '<migration_name>';
```

`finished_at` must be set and `rolled_back_at` must be null.

## B. Invalid or not-ready expected target index

Use this branch only when the single returned row has the expected target name and either
`indisvalid = false` or `indisready = false`. Drop only that exact schema-qualified index, mark
only the failed migration rolled back, and rerun deploy:

```sql
DROP INDEX CONCURRENTLY IF EXISTS public."<index_name>";
```

```powershell
npx prisma migrate resolve --rolled-back <migration_name>
npx prisma migrate deploy
```

Repeat the inspection query and the Prisma-history query from branch A. The final index must be
valid and ready, with an exact expected definition.

## C. Definition mismatch or ambiguity

If the name exists but `pg_get_indexdef` differs from `<expected_index_definition>`, if the query
returns more than one candidate, or if any mapping is uncertain: **STOP/manual DBA**. Do not run
`DROP INDEX`, `migrate resolve`, or `migrate deploy` for this incident until a DBA has reconciled
the schema and migration history.

For duplicate-key errors, resolve the identified application data explicitly before returning to
this runbook. Never run seed data, a reset, or a broad index cleanup as recovery.
